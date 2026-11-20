// src/lib/taskFiles.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  changeIndex,
  changeTasks,
  dropTasks,
  readAll,
  type TaskFs,
} from "./taskFiles";
import {
  addList,
  addTask,
  makeTask,
  parseTasks,
  removeTask,
  serializeTasks,
  setDone,
} from "./taskStore";

/** A folder in memory: path → text. `fail` makes reads of a path throw, like a locked file. */
function memoryFs(files: Record<string, string> = {}) {
  const fail = new Set<string>();
  const fs: TaskFs = {
    async read(path) {
      if (fail.has(path)) throw new Error("locked");
      return files[path] ?? null;
    },
    async write(path, text) {
      files[path] = text;
    },
    async remove(path) {
      delete files[path];
    },
  };
  return { fs, files, fail };
}

const V = "C:/vault";
const now = "2026-06-01T10:00:00.000Z";
const task = (id: string) => makeTask({ id, title: id, now });

test("a vault with no .tasks folder has the default list and nothing is written by looking", async () => {
  const { fs, files } = memoryFs();
  const { index, tasks } = await readAll(fs, V);
  assert.deepEqual(index.lists, [{ id: "tasks", name: "Tasks" }]);
  assert.deepEqual(tasks, { tasks: [] });
  assert.deepEqual(files, {});
});

test("a change is read, applied and written; the first one creates the files", async () => {
  const { fs, files } = memoryFs();
  await changeTasks(fs, V, "tasks", (t) => addTask(t, task("a")));
  await changeIndex(fs, V, (i) => addList(i, { id: "l1", name: "Home" }));
  assert.deepEqual(Object.keys(files).sort(), [
    "C:/vault/.tasks/index.json",
    "C:/vault/.tasks/tasks.json",
  ]);
  const all = await readAll(fs, V);
  assert.deepEqual(
    all.index.lists.map((l) => l.id),
    ["tasks", "l1"],
  );
  assert.deepEqual(
    all.tasks.tasks.map((t) => t.id),
    ["a"],
  );
  assert.deepEqual(all.tasks.l1, []);
});

test("what another program wrote in between is merged, not overwritten", async () => {
  const { fs, files } = memoryFs();
  await changeTasks(fs, V, "tasks", (t) => addTask(t, task("mine")));
  // an assistant adds a task straight to the file
  const path = "C:/vault/.tasks/tasks.json";
  files[path] = serializeTasks(
    addTask(parseTasks(JSON.parse(files[path])), task("theirs")),
  );
  await changeTasks(fs, V, "tasks", (t) => setDone(t, "mine", true, now));
  const tasks = parseTasks(JSON.parse(files[path]));
  assert.deepEqual(tasks.map((t) => [t.id, t.done]).sort(), [
    ["mine", true],
    ["theirs", false],
  ]);
});

test("a reducer that changes nothing writes nothing", async () => {
  const { fs, files } = memoryFs();
  await changeTasks(fs, V, "tasks", (t) => removeTask(t, "nope"));
  assert.deepEqual(files, {});
});

test("changes to one file run in the order they were asked for", async () => {
  const { fs, files } = memoryFs();
  await Promise.all(
    ["a", "b", "c", "d"].map((id) =>
      changeTasks(fs, V, "tasks", (t) => addTask(t, task(id))),
    ),
  );
  assert.deepEqual(
    parseTasks(JSON.parse(files["C:/vault/.tasks/tasks.json"]))
      .map((t) => t.id)
      .sort(),
    ["a", "b", "c", "d"],
  );
});

test("a file that is not JSON is kept as .bak before it is replaced, and reads as empty", async () => {
  const { fs, files } = memoryFs({
    "C:/vault/.tasks/tasks.json": "{ half a file",
  });
  assert.deepEqual((await readAll(fs, V)).tasks.tasks, []);
  assert.equal(files["C:/vault/.tasks/tasks.json.bak"], "{ half a file");
  await changeTasks(fs, V, "tasks", (t) => addTask(t, task("a")));
  assert.equal(files["C:/vault/.tasks/tasks.json.bak"], "{ half a file");
  assert.equal(
    parseTasks(JSON.parse(files["C:/vault/.tasks/tasks.json"])).length,
    1,
  );
});

test("a file that cannot be read is never written over", async () => {
  const { fs, files, fail } = memoryFs({
    "C:/vault/.tasks/tasks.json": serializeTasks([task("keep")]),
  });
  fail.add("C:/vault/.tasks/tasks.json");
  await assert.rejects(
    changeTasks(fs, V, "tasks", (t) => addTask(t, task("x"))),
    /locked/,
  );
  fail.clear();
  assert.deepEqual(
    parseTasks(JSON.parse(files["C:/vault/.tasks/tasks.json"])).map(
      (t) => t.id,
    ),
    ["keep"],
  );
  // and one failed change does not block the next
  await changeTasks(fs, V, "tasks", (t) => addTask(t, task("x")));
  assert.equal(
    parseTasks(JSON.parse(files["C:/vault/.tasks/tasks.json"])).length,
    2,
  );
});

test("dropping a list removes its file", async () => {
  const { fs, files } = memoryFs();
  await changeTasks(fs, V, "l1", (t) => addTask(t, task("a")));
  await dropTasks(fs, V, "l1");
  assert.deepEqual(files, {});
});
