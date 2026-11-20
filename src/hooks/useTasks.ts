// src/hooks/useTasks.ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { changeIndex, changeTasks, dropTasks, readAll } from "../lib/taskFiles";
import { tauriTaskFs } from "../lib/taskFsTauri";
import type {
  ListPatch,
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

  const commit = (next: State) => {
    ref.current = next;
    setState(next);
  };

  const reload = useCallback(async () => {
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
      console.error("[useTasks] read", err);
    }
  }, [vaultPath]);

  useEffect(() => {
    reload();
    const unlisten = getCurrentWindow().onFocusChanged(
      ({ payload: focused }) => {
        if (!focused) return;
        setToday(store.localDate());
        reload();
      },
    );
    return () => {
      unlisten.then((fn) => fn()).catch(console.error);
    };
  }, [reload]);

  // The disk side of a change. A failure is shown by reading the files again: what is there is what is true.
  const run = (job: () => Promise<unknown>) => {
    pending.current++;
    seq.current++;
    let failed = false;
    job()
      .catch((err) => {
        failed = true;
        console.error("[useTasks] write", err);
      })
      .finally(() => {
        pending.current--;
        seq.current++;
        if (failed || !loaded.current) reload();
      });
  };

  const editTasks = (listId: string, change: (t: Task[]) => Task[]) => {
    const cur = ref.current;
    const before = cur.tasks[listId];
    if (!before) return;
    const after = change(before);
    if (after === before) return;
    commit({ ...cur, tasks: { ...cur.tasks, [listId]: after } });
    run(() => changeTasks(tauriTaskFs, vaultPath, listId, change));
  };

  const editIndex = (change: (i: TaskIndex) => TaskIndex) => {
    const cur = ref.current;
    const after = change(cur.index);
    if (after === cur.index) return;
    commit({ ...cur, index: after });
    run(() => changeIndex(tauriTaskFs, vaultPath, change));
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
    editTasks(ref.current.tasks[listId] ? listId : DEFAULT_LIST_ID, (t) =>
      store.addTask(t, task),
    );
    return task.id;
  };

  const updateTask = (listId: string, id: string, patch: TaskPatch) => {
    const now = nowIso();
    editTasks(listId, (t) => store.updateTask(t, id, patch, now));
  };

  const setDone = (listId: string, id: string, done: boolean) => {
    const now = nowIso();
    editTasks(listId, (t) => store.setDone(t, id, done, now));
  };

  /** Deletes a task and gives it back, for an Undo. */
  const deleteTask = (listId: string, id: string): Task | undefined => {
    const task = ref.current.tasks[listId]?.find((t) => t.id === id);
    editTasks(listId, (t) => store.removeTask(t, id));
    return task;
  };

  /** Puts a deleted task back as it was, rank included. */
  const restoreTask = (listId: string, task: Task) =>
    editTasks(listId, (t) =>
      t.some((x) => x.id === task.id) ? t : [...t, task],
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
    });
  };

  const addStep = (listId: string, taskId: string, title: string) => {
    const step = { id: nanoid(), title, done: false };
    const now = nowIso();
    editTasks(listId, (t) => store.addStep(t, taskId, step, now));
  };

  const updateStep = (
    listId: string,
    taskId: string,
    stepId: string,
    patch: { title?: string; done?: boolean },
  ) => {
    const now = nowIso();
    editTasks(listId, (t) => store.updateStep(t, taskId, stepId, patch, now));
  };

  const removeStep = (listId: string, taskId: string, stepId: string) => {
    const now = nowIso();
    editTasks(listId, (t) => store.removeStep(t, taskId, stepId, now));
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
    run(() =>
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
    );
    return id;
  };

  const updateList = (id: string, patch: ListPatch) =>
    editIndex((i) => store.updateList(i, id, patch));

  const deleteList = (id: string) => {
    const cur = ref.current;
    const index = store.removeList(cur.index, id);
    if (index === cur.index) return;
    const { [id]: _gone, ...rest } = cur.tasks;
    commit({ index, tasks: rest });
    run(async () => {
      await changeIndex(tauriTaskFs, vaultPath, (i) => store.removeList(i, id));
      await dropTasks(tauriTaskFs, vaultPath, id);
    });
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

  const deleteGroup = (id: string) =>
    editIndex((i) => store.removeGroup(i, id));

  const rankGroups = (ranks: Record<string, number>) =>
    editIndex((i) => {
      const groups = store.withRanks(i.groups, ranks);
      return groups === i.groups ? i : { ...i, groups };
    });

  return {
    index: state.index,
    tasks: state.tasks,
    today,
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
    rankLists,
    addGroup,
    renameGroup,
    deleteGroup,
    rankGroups,
  };
}

export type TasksApi = ReturnType<typeof useTasks>;
