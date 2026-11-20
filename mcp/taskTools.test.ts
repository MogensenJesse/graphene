// mcp/taskTools.test.ts
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { test } from "vitest";
import { joinPath } from "../src/lib/paths";
import { localDate } from "../src/lib/taskStore";
import {
  addTaskTo,
  completeTaskIn,
  createTaskList,
  listTaskLists,
  listTasks,
  updateTaskIn,
} from "./taskTools";

/** An empty vault folder; removed afterwards. */
async function withVault(run: (vault: string) => Promise<void>) {
  const vault = joinPath(mkdtempSync(joinPath(tmpdir(), "graphene-tasks-")));
  try {
    await run(vault);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
}

const file = (vault: string, name: string) => joinPath(vault, ".tasks", name);
const json = (vault: string, name: string) =>
  JSON.parse(readFileSync(file(vault, name), "utf8"));

test("a vault with no tasks has the default list, and reading writes nothing", () =>
  withVault(async (vault) => {
    const lists = await listTaskLists(vault);
    assert.deepEqual(lists, {
      my_day: 0,
      important: 0,
      open: 0,
      lists: [
        { id: "tasks", name: "Tasks", group: null, color: null, open: 0 },
      ],
    });
    assert.deepEqual((await listTasks(vault, {})).tasks, []);
    assert.equal(existsSync(joinPath(vault, ".tasks")), false);
  }));

test("add, list, update, complete: tasks, steps, lists", () =>
  withVault(async (vault) => {
    const home = await createTaskList(vault, { name: "Home" });
    await assert.rejects(createTaskList(vault, { name: "home" }), /already/);
    await assert.rejects(
      createTaskList(vault, { name: "X", group: "Nope" }),
      /no group/,
    );

    const milk = await addTaskTo(vault, {
      title: "Buy milk\nnow",
      list: "HOME", // a name, any case
      due: "2026-12-01",
      important: true,
      steps: ["oat", " ", "full fat"],
    });
    assert.equal(milk.title, "Buy milk now");
    assert.equal(milk.list, "Home");
    assert.deepEqual(
      milk.steps.map((s) => s.title),
      ["oat", "full fat"],
    );
    const plain = await addTaskTo(vault, { title: "Call mum" }); // the default list
    assert.equal(plain.list, "Tasks");
    const planned = await addTaskTo(vault, {
      title: "Plan week",
      list: home.id, // or an id
      due: "2026-11-20",
      my_day: true,
    });
    assert.equal(planned.my_day, true);
    await assert.rejects(addTaskTo(vault, { title: " " }), /needs a title/);
    await assert.rejects(
      addTaskTo(vault, { title: "x", list: "Nope" }),
      /no list called/,
    );

    // soonest due first, no due date last; counts per list and for My Day / Important
    const all = await listTasks(vault, {});
    assert.deepEqual(
      all.tasks.map((t) => t.title),
      ["Plan week", "Buy milk now", "Call mum"],
    );
    assert.deepEqual(
      (await listTasks(vault, { due_by: "2026-11-30" })).tasks.map(
        (t) => t.title,
      ),
      ["Plan week"],
    );
    assert.deepEqual(
      (await listTasks(vault, { important: true })).tasks.map((t) => t.title),
      ["Buy milk now"],
    );
    assert.deepEqual(
      (await listTasks(vault, { my_day: true })).tasks.map((t) => t.title),
      ["Plan week"],
    );
    assert.deepEqual(
      (await listTasks(vault, { list: "Tasks" })).tasks.map((t) => t.title),
      ["Call mum"],
    );
    const overview = await listTaskLists(vault);
    assert.deepEqual(
      [overview.my_day, overview.important, overview.open],
      [1, 1, 3],
    );
    assert.deepEqual(
      overview.lists.map((l) => [l.name, l.open]),
      [
        ["Home", 2],
        ["Tasks", 1],
      ],
    );

    // update: fields left out stay, null takes a date off, steps append, the task can move
    const moved = await updateTaskIn(vault, {
      id: milk.id,
      due: null,
      note: "2 cartons",
      my_day: true,
      list: "Tasks",
      add_steps: ["skimmed"],
    });
    assert.equal(moved.due, null);
    assert.equal(moved.note, "2 cartons");
    assert.equal(moved.my_day, true);
    assert.equal(moved.list, "Tasks");
    assert.equal(moved.important, true); // not mentioned: kept
    assert.deepEqual(
      moved.steps.map((s) => s.title),
      ["oat", "full fat", "skimmed"],
    );
    assert.deepEqual(
      (await listTasks(vault, { list: "Home" })).tasks.map((t) => t.title),
      ["Plan week"],
    ); // it left Home
    await assert.rejects(
      updateTaskIn(vault, { id: "nope", title: "x" }),
      /No task with id/,
    );

    // complete: the task, or one of its steps; done tasks are listed on request
    const step = moved.steps[0].id;
    await completeTaskIn(vault, { id: milk.id, step });
    const ticked = (await listTasks(vault, { list: "Tasks" })).tasks.find(
      (t) => t.id === milk.id,
    );
    assert.deepEqual(
      ticked?.steps.map((s) => s.done),
      [true, false, false],
    );
    await assert.rejects(
      completeTaskIn(vault, { id: milk.id, step: "nope" }),
      /no step/,
    );
    const done = await completeTaskIn(vault, { id: milk.id });
    assert.equal(done.done, true);
    assert.equal((await listTasks(vault, {})).total, 2);
    assert.equal((await listTasks(vault, { include_done: true })).total, 3);
    assert.equal(
      (await completeTaskIn(vault, { id: milk.id, done: false })).done,
      false,
    );
  }));

test("what changed in the files by hand shows in the next call and is kept by the next write", () =>
  withVault(async (vault) => {
    await addTaskTo(vault, { title: "mine" });
    const path = file(vault, "tasks.json");
    const data = JSON.parse(readFileSync(path, "utf8"));
    data.tasks.push({ id: "byhand", title: "by hand", done: false, future: 1 });
    writeFileSync(path, JSON.stringify(data));
    assert.deepEqual(
      (await listTasks(vault, {})).tasks.map((t) => t.title).sort(),
      ["by hand", "mine"],
    );
    await completeTaskIn(vault, { id: "byhand" });
    const saved = json(vault, "tasks.json").tasks.find(
      (t: { id: string }) => t.id === "byhand",
    );
    assert.equal(saved.done, true);
    assert.equal(saved.future, 1); // a key this version does not know survives
    assert.ok(
      json(vault, "tasks.json").tasks.some(
        (t: { id: string }) => t.id !== "byhand",
      ),
    );
  }));

test("a file that is not JSON is copied to .bak before it is replaced", () =>
  withVault(async (vault) => {
    await addTaskTo(vault, { title: "first" });
    writeFileSync(file(vault, "tasks.json"), "{ broken");
    assert.deepEqual((await listTasks(vault, {})).tasks, []);
    assert.equal(
      readFileSync(file(vault, "tasks.json.bak"), "utf8"),
      "{ broken",
    );
    await addTaskTo(vault, { title: "second" });
    assert.equal(json(vault, "tasks.json").tasks.length, 1);
    assert.equal(
      readFileSync(file(vault, "tasks.json.bak"), "utf8"),
      "{ broken",
    );
  }));

test("my day is today's tasks only", () =>
  withVault(async (vault) => {
    const t = await addTaskTo(vault, { title: "old plan" });
    const path = file(vault, "tasks.json");
    const data = JSON.parse(readFileSync(path, "utf8"));
    data.tasks[0].myDay = "2000-01-01"; // yesterday's, long ago
    writeFileSync(path, JSON.stringify(data));
    assert.equal((await listTasks(vault, { my_day: true })).total, 0);
    await updateTaskIn(vault, { id: t.id, my_day: true });
    assert.equal(json(vault, "tasks.json").tasks[0].myDay, localDate());
  }));
