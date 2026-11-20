// mcp/taskTools.ts
// What the MCP server can do with a vault's to-do lists. Plain async functions like tools.ts; the rules for lists,
// tasks and their files are the app's own (src/lib/taskStore.ts, src/lib/taskFiles.ts), so both sides agree.
// There is no tool to delete or rename anything: an assistant can add and tick, not remove.
import { nanoid } from "nanoid";
import {
  changeIndex,
  changeTasks,
  readAll,
  readIndex,
} from "../src/lib/taskFiles";
import {
  addList,
  addStep,
  addTask,
  compareTasks,
  DEFAULT_LIST_ID,
  localDate,
  makeTask,
  openCount,
  orderedLists,
  removeTask,
  setDone,
  smartList,
  type Task,
  type TaskIndex,
  type TaskList,
  updateStep,
  updateTask,
} from "../src/lib/taskStore";
import { nodeTaskFs } from "./taskFsNode";

const fs = nodeTaskFs;
const now = () => new Date().toISOString();

const row = (task: Task, list: TaskList, today: string) => ({
  id: task.id,
  list: list.name,
  title: task.title,
  done: task.done,
  due: task.due ?? null,
  important: task.important === true,
  my_day: task.myDay === today,
  ...(task.note ? { note: task.note } : {}),
  steps: task.steps,
  created: task.createdAt,
  updated: task.updatedAt,
});

/** A list by id, or by name (any case). Without one, the default list. */
function pickList(index: TaskIndex, wanted: string | undefined): TaskList {
  const name = wanted?.trim();
  if (!name) {
    const list = index.lists.find((l) => l.id === DEFAULT_LIST_ID);
    if (list) return list;
    throw new Error("This vault has no default list.");
  }
  const byId = index.lists.find((l) => l.id === name);
  if (byId) return byId;
  const named = index.lists.filter(
    (l) => l.name.toLowerCase() === name.toLowerCase(),
  );
  if (named.length === 1) return named[0];
  const names = index.lists.map((l) => l.name).join(", ");
  throw new Error(
    named.length > 1
      ? `Several lists are called "${name}". Use a list id from list_task_lists.`
      : `There is no list called "${name}". Lists: ${names}.`,
  );
}

async function findTask(vault: string, id: string) {
  const { index, tasks } = await readAll(fs, vault);
  for (const list of index.lists) {
    const task = tasks[list.id]?.find((t) => t.id === id);
    if (task) return { index, list, task, tasks };
  }
  throw new Error(`No task with id "${id}". Use list_tasks to find one.`);
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function listTaskLists(vault: string) {
  const { index, tasks } = await readAll(fs, vault);
  const today = localDate();
  const lists = orderedLists(index);
  const groupName = (id?: string) =>
    index.groups.find((g) => g.id === id)?.name ?? null;
  return {
    my_day: openCount(
      smartList("my-day", lists, tasks, today).map((p) => p.task),
    ),
    important: openCount(
      smartList("important", lists, tasks, today).map((p) => p.task),
    ),
    open: lists.reduce((n, l) => n + openCount(tasks[l.id] ?? []), 0),
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      group: groupName(l.groupId),
      color: l.color ?? null,
      open: openCount(tasks[l.id] ?? []),
    })),
  };
}

/** Tasks across the lists (or one), soonest due first; those without a due date come last. */
export async function listTasks(
  vault: string,
  {
    list,
    due_by,
    important,
    my_day,
    include_done = false,
    limit = 100,
  }: {
    list?: string;
    due_by?: string;
    important?: boolean;
    my_day?: boolean;
    include_done?: boolean;
    limit?: number;
  },
) {
  const { index, tasks } = await readAll(fs, vault);
  const today = localDate();
  const lists = list ? [pickList(index, list)] : orderedLists(index);
  const rows = lists.flatMap((l) =>
    (tasks[l.id] ?? [])
      .filter(
        (t) =>
          (include_done || !t.done) &&
          (!due_by || (t.due !== undefined && t.due <= due_by)) &&
          (important === undefined || (t.important === true) === important) &&
          (my_day === undefined || (t.myDay === today) === my_day),
      )
      .sort(compareTasks)
      .map((t) => ({ task: t, list: l })),
  );
  rows.sort((a, b) =>
    (a.task.due ?? "9999").localeCompare(b.task.due ?? "9999"),
  ); // stable: the lists' own order is kept within a day
  return {
    total: rows.length,
    tasks: rows.slice(0, limit).map((r) => row(r.task, r.list, today)),
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function addTaskTo(
  vault: string,
  {
    list,
    title,
    due,
    note,
    important,
    my_day,
    steps = [],
  }: {
    list?: string;
    title: string;
    due?: string;
    note?: string;
    important?: boolean;
    my_day?: boolean;
    steps?: string[];
  },
) {
  const target = pickList(await readIndex(fs, vault), list);
  const at = now();
  const task = makeTask({
    id: nanoid(),
    title,
    now: at,
    due,
    note,
    important,
    myDay: my_day ? localDate() : undefined,
    steps: steps
      .map((s) => ({ id: nanoid(), title: s.trim(), done: false }))
      .filter((s) => s.title),
  });
  if (!task.title) throw new Error("A task needs a title.");
  await changeTasks(fs, vault, target.id, (t) => addTask(t, task));
  return row(task, target, localDate());
}

export async function updateTaskIn(
  vault: string,
  {
    id,
    title,
    due,
    note,
    important,
    my_day,
    list,
    add_steps = [],
  }: {
    id: string;
    title?: string;
    due?: string | null;
    note?: string | null;
    important?: boolean;
    my_day?: boolean;
    list?: string;
    add_steps?: string[];
  },
) {
  const found = await findTask(vault, id);
  const today = localDate();
  const at = now();
  const to = list ? pickList(found.index, list) : found.list;
  const patch = {
    title,
    due,
    note,
    important,
    myDay: my_day === undefined ? undefined : my_day ? today : null,
  };
  const steps = add_steps.filter((s) => s.trim());
  const change = (tasks: Task[]) => {
    let next = updateTask(tasks, id, patch, at);
    for (const s of steps)
      next = addStep(next, id, { id: nanoid(), title: s, done: false }, at);
    return next;
  };
  const tasks = await changeTasks(fs, vault, found.list.id, change);
  const task = tasks.find((t) => t.id === id) ?? found.task;
  if (to.id !== found.list.id) {
    // Into the new list first, then out of the old one: a crash in between leaves two copies, never none
    await changeTasks(fs, vault, to.id, (t) => addTask(t, task));
    await changeTasks(fs, vault, found.list.id, (t) => removeTask(t, id));
  }
  return row(task, to, today);
}

export async function completeTaskIn(
  vault: string,
  { id, done = true, step }: { id: string; done?: boolean; step?: string },
) {
  const found = await findTask(vault, id);
  const at = now();
  if (step !== undefined && !found.task.steps.some((s) => s.id === step))
    throw new Error(
      `The task has no step "${step}". Step ids are in list_tasks.`,
    );
  const tasks = await changeTasks(fs, vault, found.list.id, (t) =>
    step === undefined
      ? setDone(t, id, done, at)
      : updateStep(t, id, step, { done }, at),
  );
  const task = tasks.find((t) => t.id === id) ?? found.task;
  return row(task, found.list, localDate());
}

export async function createTaskList(
  vault: string,
  { name, group }: { name: string; group?: string },
) {
  const index = await readIndex(fs, vault);
  const clean = name.trim();
  if (!clean) throw new Error("A list needs a name.");
  if (index.lists.some((l) => l.name.toLowerCase() === clean.toLowerCase()))
    throw new Error(`There is a list called "${clean}" already.`);
  let groupId: string | undefined;
  if (group?.trim()) {
    const g = index.groups.find(
      (x) => x.name.toLowerCase() === group.trim().toLowerCase(),
    );
    if (!g)
      throw new Error(
        `There is no group called "${group}". Groups: ${index.groups.map((x) => x.name).join(", ") || "none"}.`,
      );
    groupId = g.id;
  }
  const list: TaskList = {
    id: nanoid(),
    name: clean,
    ...(groupId ? { groupId } : {}),
  };
  await changeIndex(fs, vault, (i) => addList(i, list));
  return { id: list.id, name: list.name, group: group?.trim() || null };
}
