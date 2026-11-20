// src/lib/taskFiles.ts
// Where a vault keeps its tasks, over a tiny file interface so the app (Tauri) and the MCP server (node) share all of it:
//   <vault>/.tasks/index.json     the lists and groups
//   <vault>/.tasks/<listId>.json  the tasks of one list
// A change is made by reading the file, applying a reducer and writing it back, so what another program (an assistant,
// a sync tool) changed in between is merged, not overwritten. ponytail: that is read-then-write, not a lock; two
// writers within the same few milliseconds can still lose one change.
import { joinPath } from "./paths";
import {
  parseIndex,
  parseTasks,
  serializeIndex,
  serializeTasks,
  type Task,
  type TaskIndex,
  type TasksByList,
} from "./taskStore";

export interface TaskFs {
  /** The file's text, or null when there is no such file. Any other failure throws, and nothing is written over it. */
  read(path: string): Promise<string | null>;
  /** Creates the folder if needed and replaces the file whole (a temp file renamed over it). */
  write(path: string, text: string): Promise<void>;
  /** A file that is not there is not an error. */
  remove(path: string): Promise<void>;
}

export const TASKS_DIR = ".tasks";

const indexPath = (vault: string) => joinPath(vault, TASKS_DIR, "index.json");
const listPath = (vault: string, id: string) =>
  joinPath(vault, TASKS_DIR, `${id}.json`);

/**
 * The JSON of a file, or undefined when it is missing or not JSON. A file that cannot be parsed is first copied to
 * <name>.bak, so what the next write replaces is never lost.
 */
async function readJson(fs: TaskFs, path: string): Promise<unknown> {
  const text = await fs.read(path);
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    await fs.write(`${path}.bak`, text);
    return undefined;
  }
}

export async function readIndex(fs: TaskFs, vault: string): Promise<TaskIndex> {
  return parseIndex(await readJson(fs, indexPath(vault)));
}

export async function readTasks(
  fs: TaskFs,
  vault: string,
  listId: string,
): Promise<Task[]> {
  return parseTasks(await readJson(fs, listPath(vault, listId)));
}

/** Everything of a vault: the index and the tasks of each of its lists. */
export async function readAll(
  fs: TaskFs,
  vault: string,
): Promise<{ index: TaskIndex; tasks: TasksByList }> {
  const index = await readIndex(fs, vault);
  const lists = await Promise.all(
    index.lists.map(
      async (l) => [l.id, await readTasks(fs, vault, l.id)] as const,
    ),
  );
  return { index, tasks: Object.fromEntries(lists) };
}

// Changes to one file run one after the other, so two quick clicks never read the same old text
const chains = new Map<string, Promise<unknown>>();
function serial<T>(key: string, run: () => Promise<T>): Promise<T> {
  const next = (chains.get(key) ?? Promise.resolve()).then(run, run);
  const tail = next.catch(() => {});
  chains.set(key, tail);
  tail.then(() => chains.get(key) === tail && chains.delete(key));
  return next;
}

/** Reads a list's file, applies `change` and writes the result; gives the new tasks. */
export function changeTasks(
  fs: TaskFs,
  vault: string,
  listId: string,
  change: (tasks: Task[]) => Task[],
): Promise<Task[]> {
  const path = listPath(vault, listId);
  return serial(path, async () => {
    const before = await readTasks(fs, vault, listId);
    const after = change(before);
    if (after !== before) await fs.write(path, serializeTasks(after));
    return after;
  });
}

/** Reads index.json, applies `change` and writes the result; gives the new index. */
export function changeIndex(
  fs: TaskFs,
  vault: string,
  change: (index: TaskIndex) => TaskIndex,
): Promise<TaskIndex> {
  const path = indexPath(vault);
  return serial(path, async () => {
    const before = await readIndex(fs, vault);
    const after = change(before);
    if (after !== before) await fs.write(path, serializeIndex(after));
    return after;
  });
}

/** Deletes a list's file (its entry in the index is the caller's to remove). */
export function dropTasks(
  fs: TaskFs,
  vault: string,
  listId: string,
): Promise<void> {
  const path = listPath(vault, listId);
  return serial(path, () => fs.remove(path));
}
