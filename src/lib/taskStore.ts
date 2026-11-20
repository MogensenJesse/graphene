// src/lib/taskStore.ts
// The to-do side of Graphene: lists, groups, tasks and their steps. Pure data and reducers (no file or clock access:
// ids and timestamps come in as arguments), shared by the app and the MCP server. The files are in taskFiles.ts.
// Every reducer returns its input as it is when nothing matches, so callers can tell nothing happened.
import { manualBy } from "./order";

// ── Types ─────────────────────────────────────────────────────────────────────

/** The accent colors of a list; the palette itself is in _variables.scss under the same names. */
export const COLOR_KEYS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export interface Step {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  /** When it was ticked (ISO), set with `done`. */
  doneAt?: string;
  important?: boolean;
  /** The day (YYYY-MM-DD) it was put on My Day; it is there only while that is today. */
  myDay?: string;
  /** YYYY-MM-DD */
  due?: string;
  note?: string;
  steps: Step[];
  /** The chosen place among its list's tasks; see order.ts. */
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskList {
  id: string;
  name: string;
  color?: ColorKey;
  groupId?: string;
  order?: number;
}

export interface TaskGroup {
  id: string;
  name: string;
  order?: number;
}

/** What index.json holds: the lists (not their tasks) and the groups they sit in. */
export interface TaskIndex {
  groups: TaskGroup[];
  lists: TaskList[];
}

export type TasksByList = Record<string, Task[]>;

/** The list that always exists: a new task without a list goes here, and it cannot be deleted. */
export const DEFAULT_LIST_ID = "tasks";

const TOP_GAP = 1024; // how far above the top rank a new task is put

const EPOCH = "1970-01-01T00:00:00.000Z";

// ── Reading and writing the JSON ──────────────────────────────────────────────
// Tolerant on the way in (a bad entry is dropped, the rest is kept) and faithful on the way out: keys this version
// does not know stay on the entry, so a file written by a newer app survives an older one.

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (v: unknown): v is string => isStr(v) && DAY.test(v);

// Ids become file names (<id>.json), so nothing but what nanoid writes; "index" is the index file's own name
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const isId = (v: unknown): v is string => isStr(v) && SAFE_ID.test(v);
const isListId = (v: unknown): v is string => isId(v) && v !== "index";

/** `raw` without the listed keys whose value is not what it should be. */
function keepValid(raw: Raw, ok: Record<string, (v: unknown) => boolean>): Raw {
  const out = { ...raw };
  for (const [key, check] of Object.entries(ok))
    if (key in out && !check(out[key])) delete out[key];
  return out;
}

/** The entries that parse, first one wins on a repeated id. */
function parseEach<T extends { id: string }>(
  value: unknown,
  parse: (raw: unknown) => T | null,
): T[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const raw of value) {
    const entry = parse(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

function parseStep(raw: unknown): Step | null {
  if (!isRecord(raw) || !isId(raw.id) || !isStr(raw.title)) return null;
  return { ...raw, id: raw.id, title: raw.title, done: raw.done === true };
}

function parseTask(raw: unknown): Task | null {
  if (!isRecord(raw) || !isId(raw.id) || !isStr(raw.title)) return null;
  const known = keepValid(raw, {
    doneAt: isStr,
    important: isBool,
    myDay: isDay,
    due: isDay,
    note: isStr,
    order: isNum,
  });
  const updatedAt = isStr(raw.updatedAt) ? raw.updatedAt : undefined;
  const createdAt = isStr(raw.createdAt) ? raw.createdAt : (updatedAt ?? EPOCH);
  return {
    ...known,
    id: raw.id,
    title: raw.title,
    done: raw.done === true,
    steps: parseEach(raw.steps, parseStep),
    createdAt,
    updatedAt: updatedAt ?? createdAt,
  };
}

/** The tasks of a list file's parsed JSON. */
export function parseTasks(value: unknown): Task[] {
  return parseEach(isRecord(value) ? value.tasks : undefined, parseTask);
}

export function serializeTasks(tasks: Task[]): string {
  return `${JSON.stringify({ version: 1, tasks }, null, 2)}\n`;
}

function parseGroup(raw: unknown): TaskGroup | null {
  if (!isRecord(raw) || !isListId(raw.id) || !isStr(raw.name)) return null;
  return {
    ...keepValid(raw, { order: isNum }),
    id: raw.id,
    name: raw.name,
  };
}

function parseList(raw: unknown): TaskList | null {
  if (!isRecord(raw) || !isListId(raw.id) || !isStr(raw.name)) return null;
  return {
    ...keepValid(raw, {
      color: (v) => COLOR_KEYS.includes(v as ColorKey),
      groupId: isStr,
      order: isNum,
    }),
    id: raw.id,
    name: raw.name,
  };
}

/** The lists and groups of index.json's parsed JSON. The default list is always in the answer. */
export function parseIndex(value: unknown): TaskIndex {
  const root = isRecord(value) ? value : {};
  const groups = parseEach(root.groups, parseGroup);
  const known = new Set(groups.map((g) => g.id));
  const lists = parseEach(root.lists, parseList).map((l) =>
    l.groupId !== undefined && !known.has(l.groupId)
      ? withoutKey(l, "groupId")
      : l,
  );
  if (!lists.some((l) => l.id === DEFAULT_LIST_ID))
    lists.unshift({ id: DEFAULT_LIST_ID, name: "Tasks" });
  return { groups, lists };
}

export function serializeIndex(index: TaskIndex): string {
  return `${JSON.stringify({ version: 1, ...index }, null, 2)}\n`;
}

function withoutKey<T extends object, K extends keyof T>(
  obj: T,
  key: K,
): Omit<T, K> {
  const { [key]: _gone, ...rest } = obj;
  return rest;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

/** A title as one line: line breaks become spaces, the ends are trimmed. May come out empty. */
export const cleanTitle = (title: string): string =>
  title.replace(/\s*[\r\n]+\s*/g, " ").trim();

export function makeTask(init: {
  id: string;
  title: string;
  now: string;
  due?: string;
  note?: string;
  important?: boolean;
  myDay?: string;
  steps?: Step[];
}): Task {
  const task: Task = {
    id: init.id,
    title: cleanTitle(init.title),
    done: false,
    steps: init.steps ?? [],
    createdAt: init.now,
    updatedAt: init.now,
  };
  if (isDay(init.due)) task.due = init.due;
  if (init.note?.trim()) task.note = init.note;
  if (init.important) task.important = true;
  if (isDay(init.myDay)) task.myDay = init.myDay;
  return task;
}

function mapTask(tasks: Task[], id: string, change: (t: Task) => Task): Task[] {
  const at = tasks.findIndex((t) => t.id === id);
  if (at < 0) return tasks;
  const changed = change(tasks[at]);
  if (changed === tasks[at]) return tasks;
  const next = tasks.slice();
  next[at] = changed;
  return next;
}

/**
 * Puts a task in a list. It shows on top: unranked tasks are listed newest first already, and when the list has a
 * chosen order the new one gets a rank above the top one. A task moved in from another list loses its old rank.
 */
export function addTask(tasks: Task[], task: Task): Task[] {
  if (tasks.some((t) => t.id === task.id)) return tasks;
  const ranks = tasks.flatMap((t) => (t.order === undefined ? [] : [t.order]));
  const placed = withoutKey(task, "order") as Task;
  if (ranks.length) placed.order = Math.min(...ranks) - TOP_GAP;
  return [placed, ...tasks];
}

export interface TaskPatch {
  title?: string;
  /** null takes it off */
  due?: string | null;
  note?: string | null;
  important?: boolean;
  myDay?: string | null;
}

export function updateTask(
  tasks: Task[],
  id: string,
  patch: TaskPatch,
  now: string,
): Task[] {
  return mapTask(tasks, id, (t) => {
    const next: Task = { ...t, updatedAt: now };
    const title = patch.title === undefined ? "" : cleanTitle(patch.title);
    if (title) next.title = title; // a title is never emptied
    if (patch.due !== undefined) {
      if (isDay(patch.due)) next.due = patch.due;
      else if (patch.due === null) delete next.due;
    }
    if (patch.myDay !== undefined) {
      if (isDay(patch.myDay)) next.myDay = patch.myDay;
      else if (patch.myDay === null) delete next.myDay;
    }
    if (patch.note !== undefined) {
      if (patch.note?.trim()) next.note = patch.note;
      else delete next.note;
    }
    if (patch.important !== undefined) {
      if (patch.important) next.important = true;
      else delete next.important;
    }
    return next;
  });
}

export function setDone(
  tasks: Task[],
  id: string,
  done: boolean,
  now: string,
): Task[] {
  return mapTask(tasks, id, (t) => {
    if (t.done === done) return t;
    const next: Task = { ...t, done, updatedAt: now };
    if (done) next.doneAt = now;
    else delete next.doneAt;
    return next;
  });
}

export function removeTask(tasks: Task[], id: string): Task[] {
  return tasks.some((t) => t.id === id)
    ? tasks.filter((t) => t.id !== id)
    : tasks;
}

/** Writes the given ranks (id → order) onto the entries they name. */
export function withRanks<T extends { id: string; order?: number }>(
  entries: T[],
  ranks: Record<string, number>,
): T[] {
  if (!entries.some((e) => e.id in ranks)) return entries;
  return entries.map((e) => (e.id in ranks ? { ...e, order: ranks[e.id] } : e));
}

// ── Steps (one level: a step has no steps) ────────────────────────────────────

export function addStep(
  tasks: Task[],
  taskId: string,
  step: Step,
  now: string,
): Task[] {
  const title = cleanTitle(step.title);
  if (!title) return tasks;
  return mapTask(tasks, taskId, (t) =>
    t.steps.some((s) => s.id === step.id)
      ? t
      : {
          ...t,
          steps: [...t.steps, { id: step.id, title, done: step.done }],
          updatedAt: now,
        },
  );
}

export function updateStep(
  tasks: Task[],
  taskId: string,
  stepId: string,
  patch: { title?: string; done?: boolean },
  now: string,
): Task[] {
  return mapTask(tasks, taskId, (t) => {
    if (!t.steps.some((s) => s.id === stepId)) return t;
    const title = patch.title === undefined ? "" : cleanTitle(patch.title);
    return {
      ...t,
      updatedAt: now,
      steps: t.steps.map((s) =>
        s.id !== stepId
          ? s
          : { ...s, title: title || s.title, done: patch.done ?? s.done },
      ),
    };
  });
}

export function removeStep(
  tasks: Task[],
  taskId: string,
  stepId: string,
  now: string,
): Task[] {
  return mapTask(tasks, taskId, (t) =>
    t.steps.some((s) => s.id === stepId)
      ? { ...t, steps: t.steps.filter((s) => s.id !== stepId), updatedAt: now }
      : t,
  );
}

// ── Lists and groups ──────────────────────────────────────────────────────────

export function addList(index: TaskIndex, list: TaskList): TaskIndex {
  const name = cleanTitle(list.name);
  if (!name || index.lists.some((l) => l.id === list.id)) return index;
  return { ...index, lists: [...index.lists, { ...list, name }] };
}

export interface ListPatch {
  name?: string;
  /** null takes it off */
  color?: ColorKey | null;
  /** null moves the list out of its group */
  groupId?: string | null;
}

export function updateList(
  index: TaskIndex,
  id: string,
  patch: ListPatch,
): TaskIndex {
  if (!index.lists.some((l) => l.id === id)) return index;
  return {
    ...index,
    lists: index.lists.map((l) => {
      if (l.id !== id) return l;
      const next: TaskList = { ...l };
      const name = patch.name === undefined ? "" : cleanTitle(patch.name);
      if (name) next.name = name;
      if (patch.color === null) delete next.color;
      else if (patch.color && COLOR_KEYS.includes(patch.color))
        next.color = patch.color;
      if (patch.groupId === null) delete next.groupId;
      else if (
        patch.groupId !== undefined &&
        index.groups.some((g) => g.id === patch.groupId)
      )
        next.groupId = patch.groupId;
      return next;
    }),
  };
}

/** Takes a list out of the index. The default list stays. The caller drops the list's file. */
export function removeList(index: TaskIndex, id: string): TaskIndex {
  if (id === DEFAULT_LIST_ID || !index.lists.some((l) => l.id === id))
    return index;
  return { ...index, lists: index.lists.filter((l) => l.id !== id) };
}

export function addGroup(index: TaskIndex, group: TaskGroup): TaskIndex {
  const name = cleanTitle(group.name);
  if (!name || index.groups.some((g) => g.id === group.id)) return index;
  return { ...index, groups: [...index.groups, { ...group, name }] };
}

export function renameGroup(
  index: TaskIndex,
  id: string,
  name: string,
): TaskIndex {
  const clean = cleanTitle(name);
  if (!clean || !index.groups.some((g) => g.id === id)) return index;
  return {
    ...index,
    groups: index.groups.map((g) => (g.id === id ? { ...g, name: clean } : g)),
  };
}

/** Takes a group away; its lists stay, outside any group. */
export function removeGroup(index: TaskIndex, id: string): TaskIndex {
  if (!index.groups.some((g) => g.id === id)) return index;
  return {
    groups: index.groups.filter((g) => g.id !== id),
    lists: index.lists.map((l) =>
      l.groupId === id ? (withoutKey(l, "groupId") as TaskList) : l,
    ),
  };
}

// ── Looking at them ───────────────────────────────────────────────────────────

/** A list's own view: the chosen order first, then the rest, newest first. */
export function compareTasks(a: Task, b: Task): number {
  const ra = a.order ?? Number.POSITIVE_INFINITY;
  const rb = b.order ?? Number.POSITIVE_INFINITY;
  if (ra !== rb) return ra < rb ? -1 : 1;
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

export const compareListsManual = manualBy<TaskList>((l) => l.name);
export const compareGroupsManual = manualBy<TaskGroup>((g) => g.name);

export const sortedGroups = (index: TaskIndex): TaskGroup[] =>
  index.groups.slice().sort(compareGroupsManual);

/** The lists of one group (null: those outside any), in their order. */
export const sortedLists = (
  index: TaskIndex,
  groupId: string | null,
): TaskList[] =>
  index.lists
    .filter((l) => (l.groupId ?? null) === groupId)
    .sort(compareListsManual);

/** Every list as the sidebar shows them: the groups' lists first, then those outside any group. */
export const orderedLists = (index: TaskIndex): TaskList[] => [
  ...sortedGroups(index).flatMap((g) => sortedLists(index, g.id)),
  ...sortedLists(index, null),
];

/** A list's tasks as its view shows them: the open ones in order, then the finished, last ticked first. */
export function splitDone(tasks: Task[]): { open: Task[]; done: Task[] } {
  return {
    open: tasks.filter((t) => !t.done).sort(compareTasks),
    done: tasks
      .filter((t) => t.done)
      .sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "")),
  };
}

export const openCount = (tasks: Task[]): number =>
  tasks.reduce((n, t) => n + (t.done ? 0 : 1), 0);

export type SmartList = "my-day" | "important";

export interface Placed {
  listId: string;
  task: Task;
}

/**
 * The tasks of My Day (put there today: it empties itself overnight) or Important, from every list. The lists
 * come in the order given, each list's tasks in its own order.
 */
export function smartList(
  key: SmartList,
  lists: TaskList[],
  byList: TasksByList,
  today: string,
): Placed[] {
  return lists.flatMap((l) =>
    (byList[l.id] ?? [])
      .filter((t) => (key === "my-day" ? t.myDay === today : t.important))
      .sort(compareTasks)
      .map((task) => ({ listId: l.id, task })),
  );
}

/** Today as YYYY-MM-DD in local time. */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dueStatus(
  date: string,
  today = localDate(),
): "overdue" | "today" | "later" {
  return date < today ? "overdue" : date === today ? "today" : "later";
}
