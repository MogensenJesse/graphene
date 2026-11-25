// src/lib/taskFsTauri.test.ts
// The task files through Tauri's fs plugin, over an in-memory stand-in that logs every plugin call: each one is an IPC round trip,
// so the number of them is part of the contract (a change of a list is 3, a read of a file that is there is 1).
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const plugin = vi.hoisted(() => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const log: string[] = [];
  /** Paths that exist but cannot be read, like a file another program has locked. */
  const locked = new Set<string>();
  const parent = (p: string) => p.slice(0, p.lastIndexOf("/"));
  return {
    files,
    dirs,
    log,
    locked,
    async exists(p: string) {
      log.push("exists");
      return files.has(p) || dirs.has(p);
    },
    async readTextFile(p: string) {
      log.push("read");
      if (locked.has(p)) throw new Error("locked");
      const text = files.get(p);
      if (text === undefined) throw new Error("no such file");
      return text;
    },
    async writeTextFile(p: string, text: string) {
      log.push("write");
      if (!dirs.has(parent(p))) throw new Error("no such folder");
      files.set(p, text);
    },
    async mkdir(p: string) {
      log.push("mkdir");
      dirs.add(p);
    },
    async rename(from: string, to: string) {
      log.push("rename");
      files.set(to, files.get(from) ?? "");
      files.delete(from);
    },
    async remove(p: string) {
      log.push("remove");
      if (!files.delete(p)) throw new Error("no such file");
    },
  };
});

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: plugin.exists,
  mkdir: plugin.mkdir,
  readTextFile: plugin.readTextFile,
  remove: plugin.remove,
  rename: plugin.rename,
  writeTextFile: plugin.writeTextFile,
}));

const { changeTasks, readAll } = await import("./taskFiles");
const { tauriTaskFs } = await import("./taskFsTauri");
const { addTask, makeTask, parseTasks, serializeIndex, serializeTasks } =
  await import("./taskStore");

const V = "C:/vault";
const dir = `${V}/.tasks`;
const now = "2026-06-01T10:00:00.000Z";
const task = (id: string) => makeTask({ id, title: id, now });

beforeEach(() => {
  plugin.files.clear();
  plugin.dirs.clear();
  plugin.locked.clear();
  plugin.log.length = 0;
});

test("a file that is there is read with one call, and one that is not is null", async () => {
  plugin.files.set(`${dir}/a.json`, "{}");
  assert.equal(await tauriTaskFs.read(`${dir}/a.json`), "{}");
  assert.deepEqual(plugin.log, ["read"]);

  plugin.log.length = 0;
  assert.equal(await tauriTaskFs.read(`${dir}/none.json`), null);
  assert.deepEqual(plugin.log, ["read", "exists"]); // asked only after the failure
});

test("a file that is there but cannot be read throws, so nothing writes over it", async () => {
  plugin.files.set(`${dir}/a.json`, "{}");
  plugin.locked.add(`${dir}/a.json`);
  await assert.rejects(tauriTaskFs.read(`${dir}/a.json`), /locked/);
});

test("a write is two calls when the folder is there: the temp file, then the rename over the file", async () => {
  plugin.dirs.add(dir);
  await tauriTaskFs.write(`${dir}/a.json`, "x");
  assert.deepEqual(plugin.log, ["write", "rename"]);
  assert.equal(plugin.files.get(`${dir}/a.json`), "x");
  assert.equal(plugin.files.has(`${dir}/a.json.tmp`), false);
});

test("the first write in a vault makes the folder, after looking that the vault's own folder is there", async () => {
  plugin.dirs.add(V);
  await tauriTaskFs.write(`${dir}/a.json`, "x");
  assert.deepEqual(plugin.log, ["write", "exists", "mkdir", "write", "rename"]);
  assert.equal(plugin.files.get(`${dir}/a.json`), "x");
  // the vault is known now: the next first write in it asks nothing more
  plugin.dirs.delete(dir);
  plugin.log.length = 0;
  await tauriTaskFs.write(`${dir}/b.json`, "y");
  assert.deepEqual(plugin.log, ["write", "mkdir", "write", "rename"]);
});

test("a write never makes a vault folder that is gone, and nothing is written", async () => {
  // no V in the stand-in: a renamed or unplugged vault
  await assert.rejects(
    tauriTaskFs.write("C:/gone/.tasks/a.json", "x"),
    /vault folder is not there/,
  );
  assert.deepEqual(plugin.log, ["write", "exists"]); // no mkdir, no second write
  assert.equal(plugin.dirs.size, 0);
  assert.equal(plugin.files.size, 0);
});

test("removing a file that is not there is not an error", async () => {
  plugin.files.set(`${dir}/a.json`, "{}");
  await tauriTaskFs.remove(`${dir}/a.json`);
  assert.deepEqual(plugin.log, ["remove"]);
  assert.equal(plugin.files.size, 0);
  await tauriTaskFs.remove(`${dir}/a.json`);
});

test("a change of a list costs 3 calls (it was 5): read, write the temp file, rename it", async () => {
  plugin.dirs.add(dir);
  plugin.files.set(`${dir}/tasks.json`, serializeTasks([task("a")]));
  await changeTasks(tauriTaskFs, V, "tasks", (t) => addTask(t, task("b")));
  assert.deepEqual(plugin.log, ["read", "write", "rename"]);
  assert.equal(
    parseTasks(JSON.parse(plugin.files.get(`${dir}/tasks.json`) ?? "")).length,
    2,
  );
});

test("a change that changes nothing is one call", async () => {
  plugin.dirs.add(dir);
  plugin.files.set(`${dir}/tasks.json`, serializeTasks([task("a")]));
  await changeTasks(tauriTaskFs, V, "tasks", (t) => t);
  assert.deepEqual(plugin.log, ["read"]);
});

test("a full read is one call per file that is there (it was two), and a file that is not there is two", async () => {
  plugin.dirs.add(dir);
  const index = {
    groups: [],
    lists: [
      { id: "tasks", name: "Tasks" },
      { id: "l1", name: "Home" },
      { id: "l2", name: "Empty" }, // never had a task: no file
    ],
  };
  plugin.files.set(`${dir}/index.json`, serializeIndex(index));
  plugin.files.set(`${dir}/tasks.json`, serializeTasks([task("a")]));
  plugin.files.set(`${dir}/l1.json`, serializeTasks([task("b")]));

  const all = await readAll(tauriTaskFs, V);
  assert.deepEqual(Object.keys(all.tasks).sort(), ["l1", "l2", "tasks"]);
  assert.deepEqual(plugin.log.sort(), [
    "exists", // the one list with no file
    "read",
    "read",
    "read",
    "read", // index, tasks, l1, and the failed read of l2
  ]);
});
