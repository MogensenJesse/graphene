// src/hooks/useTasks.ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { reportError } from "../lib/reportError";
import { rescanDue } from "../lib/rescanGate";
import { changeIndex, changeTasks, dropTasks, readAll } from "../lib/taskFiles";
import { tauriTaskFs } from "../lib/taskFsTauri";
import type {
  GroupSnapshot,
  ListPatch,
  ListSnapshot,
  Task,
  TaskIndex,
  TaskPatch,
  TasksByList,
} from "../lib/taskStore";
import * as store from "../lib/taskStore";
import { DEFAULT_LIST_ID } from "../lib/taskStore";

interface State {
  index: TaskIndex;
  tasks: TasksByList;
}

const EMPTY: State = {
  index: store.parseIndex(undefined),
  tasks: { [DEFAULT_LIST_ID]: [] },
};

const nowIso = () => new Date().toISOString();

/**
 * The tasks of one vault. Every action changes the state in memory at once and then repeats the same change on
 * the files (see lib/taskFiles: read, apply, write), so the screen never waits for the disk and a change made by
 * an assistant in between is merged. Coming back to the window reads the files again.
 */
export function useTasks(vaultPath: string) {
  const [state, setState] = useState<State>(EMPTY);
  const [today, setToday] = useState(store.localDate);
  const ref = useRef(state);
  // Writes of ours that have not finished, and a counter that moves when one starts or ends: a read that
  // overlapped one is thrown away
  const pending = useRef(0);
  const seq = useRef(0);
  const loaded = useRef(false);
  // The same writes as promises, for `settled`
  const writes = useRef(new Set<Promise<unknown>>());
  // The writes of ours that failed and have not landed since, by the job: each with the call that shows its error toast (with
  // its Retry) again. A failed change is off the screen (the files are read again), so closing the window, the updater and a
  // vault switch ask whether this is empty, as they ask `unsaved` of the notes. Not run again on their own: the job would apply
  // its old change over a newer one to the same field
  const [unsaved] = useState(() => new Map<unknown, () => void>());

  // `quiet`: right after a failed write, whose own message must stay on screen
  const reload = useCallback(
    async function load(quiet = false) {
      if (pending.current > 0) return;
      const before = seq.current;
      try {
        const next = await readAll(tauriTaskFs, vaultPath);
        if (pending.current > 0 || seq.current !== before) return;
        loaded.current = true;
        if (JSON.stringify(next) !== JSON.stringify(ref.current)) {
          ref.current = next;
          setState(next);
        }
      } catch (err) {
        if (quiet) console.error("[useTasks] read", err);
        else reportError("Could not read your tasks", err, () => load());
      }
    },
    [vaultPath],
  );

  // The files are read again when the window gets focus, but not more than every 5 s (restoring a minimised window sends several
  // events), with the same gate as the notes. A first load that has not landed yet is not held back
  const lastReload = useRef(Date.now());
  useEffect(() => {
    reload();
    const unlisten = getCurrentWindow().onFocusChanged(
      ({ payload: focused }) => {
        if (!focused) return;
        setToday(store.localDate());
        if (loaded.current && !rescanDue(lastReload.current, Date.now()))
          return;
        lastReload.current = Date.now();
        reload();
      },
    );
    return () => {
      unlisten.then((fn) => fn()).catch(console.error);
    };
  }, [reload]);

  /** Resolves once every write of ours has landed or failed: the window waits for it before it closes. */
  const settled = useCallback(async () => {
    await Promise.all(writes.current);
  }, []);

  // The actions only read refs and the vault path, so they are made once per vault: the same functions on every render, which is
  // what lets a task row (memo) keep its props instead of rendering again for a new function
  const actions = useMemo(() => {
    const commit = (next: State) => {
      ref.current = next;
      setState(next);
    };

    // The disk side of a change. A failure is shown to the user and the files are read again: what is there is what is
    // true, so the change goes off the screen. Retry runs the same job and reads the files again, so it comes back.
    // `what` names what was changed: `Could not save <what>`.
    const run = (
      job: () => Promise<unknown>,
      what: string,
      retrying = false,
    ) => {
      pending.current++;
      seq.current++;
      let failed = false;
      const done = job()
        .then(
          () => {
            unsaved.delete(job);
          },
          (err) => {
            failed = true;
            const tell = () =>
              reportError(`Could not save ${what}`, err, () =>
                run(job, what, true),
              );
            unsaved.set(job, tell);
            tell();
          },
        )
        .finally(() => {
          pending.current--;
          seq.current++;
          if (failed || retrying || !loaded.current) reload(failed);
        });
      writes.current.add(done);
      done.then(() => writes.current.delete(done));
    };

    // How a task or list is named in `Could not save ...`
    const taskName = (listId: string, id: string) => {
      const task = ref.current.tasks[listId]?.find((t) => t.id === id);
      return task ? `"${task.title}"` : "your tasks";
    };
    const listName = (id: string) => {
      const list = ref.current.index.lists.find((l) => l.id === id);
      return list ? `the list "${list.name}"` : "your lists";
    };

    const editTasks = (
      listId: string,
      change: (t: Task[]) => Task[],
      what = "your tasks",
    ) => {
      const cur = ref.current;
      const before = cur.tasks[listId];
      if (!before) return;
      const after = change(before);
      if (after === before) return;
      commit({ ...cur, tasks: { ...cur.tasks, [listId]: after } });
      run(() => changeTasks(tauriTaskFs, vaultPath, listId, change), what);
    };

    const editIndex = (
      change: (i: TaskIndex) => TaskIndex,
      what = "your lists",
    ) => {
      const cur = ref.current;
      const after = change(cur.index);
      if (after === cur.index) return;
      commit({ ...cur, index: after });
      run(() => changeIndex(tauriTaskFs, vaultPath, change), what);
    };

    // ── Tasks ───────────────────────────────────────────────────────────────────

    /** Adds a task to a list (the default one when `listId` is not a list); gives its id, or null for an empty title. */
    const addTask = (
      listId: string,
      fields: {
        title: string;
        due?: string;
        myDay?: string;
        important?: boolean;
      },
    ): string | null => {
      if (!store.cleanTitle(fields.title)) return null;
      const task = store.makeTask({ ...fields, id: nanoid(), now: nowIso() });
      editTasks(
        ref.current.tasks[listId] ? listId : DEFAULT_LIST_ID,
        (t) => store.addTask(t, task),
        `"${task.title}"`,
      );
      return task.id;
    };

    const updateTask = (listId: string, id: string, patch: TaskPatch) => {
      const now = nowIso();
      editTasks(
        listId,
        (t) => store.updateTask(t, id, patch, now),
        taskName(listId, id),
      );
    };

    const setDone = (listId: string, id: string, done: boolean) => {
      const now = nowIso();
      editTasks(
        listId,
        (t) => store.setDone(t, id, done, now),
        taskName(listId, id),
      );
    };

    /** Deletes a task and gives it back, for an Undo. */
    const deleteTask = (listId: string, id: string): Task | undefined => {
      const task = ref.current.tasks[listId]?.find((t) => t.id === id);
      editTasks(listId, (t) => store.removeTask(t, id), taskName(listId, id));
      return task;
    };

    /** Puts a deleted task back as it was, rank included. */
    const restoreTask = (listId: string, task: Task) =>
      editTasks(
        listId,
        (t) => (t.some((x) => x.id === task.id) ? t : [...t, task]),
        `"${task.title}"`,
      );

    /** To another list, on top there. It is added to the new file before it leaves the old one, so a crash never loses it. */
    const moveTask = (fromId: string, toId: string, id: string) => {
      const cur = ref.current;
      const task = cur.tasks[fromId]?.find((t) => t.id === id);
      const to = cur.tasks[toId];
      if (!task || !to || fromId === toId) return;
      commit({
        ...cur,
        tasks: {
          ...cur.tasks,
          [toId]: store.addTask(to, task),
          [fromId]: store.removeTask(cur.tasks[fromId], id),
        },
      });
      run(async () => {
        await changeTasks(tauriTaskFs, vaultPath, toId, (t) =>
          store.addTask(t, task),
        );
        await changeTasks(tauriTaskFs, vaultPath, fromId, (t) =>
          store.removeTask(t, id),
        );
      }, `"${task.title}"`);
    };

    const addStep = (listId: string, taskId: string, title: string) => {
      const step = { id: nanoid(), title, done: false };
      const now = nowIso();
      editTasks(
        listId,
        (t) => store.addStep(t, taskId, step, now),
        taskName(listId, taskId),
      );
    };

    const updateStep = (
      listId: string,
      taskId: string,
      stepId: string,
      patch: { title?: string; done?: boolean },
    ) => {
      const now = nowIso();
      editTasks(
        listId,
        (t) => store.updateStep(t, taskId, stepId, patch, now),
        taskName(listId, taskId),
      );
    };

    const removeStep = (listId: string, taskId: string, stepId: string) => {
      const now = nowIso();
      editTasks(
        listId,
        (t) => store.removeStep(t, taskId, stepId, now),
        taskName(listId, taskId),
      );
    };

    /** Writes ranks (id → order) onto a list's tasks: what a drag in the list's own view comes to. */
    const rankTasks = (listId: string, ranks: Record<string, number>) =>
      editTasks(listId, (t) => store.withRanks(t, ranks));

    // ── Lists and groups ────────────────────────────────────────────────────────

    /** Gives the new list's id, or null for an empty name. */
    const addList = (name: string, groupId?: string): string | null => {
      if (!store.cleanTitle(name)) return null;
      const id = nanoid();
      const list = { id, name, ...(groupId ? { groupId } : {}) };
      const index = store.addList(ref.current.index, list);
      if (index === ref.current.index) return null;
      commit({ index, tasks: { ...ref.current.tasks, [id]: [] } });
      run(
        () =>
          changeIndex(tauriTaskFs, vaultPath, (i) =>
            // a group removed on the disk in the meantime: the list goes in without one
            store.addList(i, {
              ...list,
              groupId:
                groupId && i.groups.some((g) => g.id === groupId)
                  ? groupId
                  : undefined,
            }),
          ),
        `the list "${list.name}"`,
      );
      return id;
    };

    const updateList = (id: string, patch: ListPatch) =>
      editIndex((i) => store.updateList(i, id, patch), listName(id));

    // A list's delete that is still writing, by id: its Undo waits for it, or it would write the file back before the delete removed it
    const deleting = new Map<string, Promise<void>>();

    /** Deletes a list with its tasks (ticked ones too) and gives it back as it was, for an Undo; nothing for the default list. */
    const deleteList = (id: string): ListSnapshot | undefined => {
      const cur = ref.current;
      const list = cur.index.lists.find((l) => l.id === id);
      const index = store.removeList(cur.index, id);
      if (!list || index === cur.index) return undefined;
      const what = listName(id);
      const { [id]: tasks = [], ...rest } = cur.tasks;
      commit({ index, tasks: rest });
      run(() => {
        const done = (async () => {
          await changeIndex(tauriTaskFs, vaultPath, (i) =>
            store.removeList(i, id),
          );
          await dropTasks(tauriTaskFs, vaultPath, id);
        })();
        const tail = done.then(
          () => {},
          () => {},
        );
        deleting.set(id, tail);
        tail.then(() => deleting.get(id) === tail && deleting.delete(id));
        return done;
      }, what);
      return { list, tasks };
    };

    /** Puts a deleted list back with its tasks, ranks and group. The tasks file goes first, so a crash never leaves a list that lost its tasks. */
    const restoreList = ({ list, tasks }: ListSnapshot) => {
      const cur = ref.current;
      const index = store.restoreList(cur.index, list);
      if (index === cur.index) return;
      commit({ index, tasks: { ...cur.tasks, [list.id]: tasks } });
      run(async () => {
        await deleting.get(list.id);
        await changeTasks(tauriTaskFs, vaultPath, list.id, (t) =>
          store.restoreTasks(t, tasks),
        );
        await changeIndex(tauriTaskFs, vaultPath, (i) =>
          store.restoreList(i, list),
        );
      }, `the list "${list.name}"`);
    };

    const rankLists = (ranks: Record<string, number>) =>
      editIndex((i) => {
        const lists = store.withRanks(i.lists, ranks);
        return lists === i.lists ? i : { ...i, lists };
      });

    const addGroup = (name: string): string | null => {
      const id = nanoid();
      const index = store.addGroup(ref.current.index, { id, name });
      if (index === ref.current.index) return null;
      editIndex((i) => store.addGroup(i, { id, name }));
      return id;
    };

    const renameGroup = (id: string, name: string) =>
      editIndex((i) => store.renameGroup(i, id, name));

    /** Deletes a group (its lists stay, outside any group) and gives it back with those lists' ids, for an Undo. */
    const deleteGroup = (id: string): GroupSnapshot | undefined => {
      const { groups, lists } = ref.current.index;
      const group = groups.find((g) => g.id === id);
      if (!group) return undefined;
      editIndex((i) => store.removeGroup(i, id), `the group "${group.name}"`);
      return {
        group,
        listIds: lists.filter((l) => l.groupId === id).map((l) => l.id),
      };
    };

    /** Puts a deleted group back with its rank, and its lists back in it. */
    const restoreGroup = ({ group, listIds }: GroupSnapshot) =>
      editIndex(
        (i) => store.restoreGroup(i, group, listIds),
        `the group "${group.name}"`,
      );

    const rankGroups = (ranks: Record<string, number>) =>
      editIndex((i) => {
        const groups = store.withRanks(i.groups, ranks);
        return groups === i.groups ? i : { ...i, groups };
      });

    return {
      addTask,
      updateTask,
      setDone,
      deleteTask,
      restoreTask,
      moveTask,
      addStep,
      updateStep,
      removeStep,
      rankTasks,
      addList,
      updateList,
      deleteList,
      restoreList,
      rankLists,
      addGroup,
      renameGroup,
      deleteGroup,
      restoreGroup,
      rankGroups,
    };
  }, [vaultPath, reload, unsaved]);

  // One object until the tasks, the day or an action change: a prop of the lists and the pane, so a render of the app for
  // another reason (a batch of note texts, a toast) does not render them again
  return useMemo(
    () => ({
      index: state.index,
      tasks: state.tasks,
      today,
      ...actions,
      settled,
      unsaved,
    }),
    [state, today, actions, settled, unsaved],
  );
}

export type TasksApi = ReturnType<typeof useTasks>;
