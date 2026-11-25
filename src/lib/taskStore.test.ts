// src/lib/taskStore.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { placeNear } from "./order";
import {
  addGroup,
  addList,
  addStep,
  addTask,
  DEFAULT_LIST_ID,
  dueStatus,
  makeTask,
  openCount,
  parseIndex,
  parseTasks,
  removeGroup,
  removeList,
  removeStep,
  removeTask,
  renameGroup,
  restoreGroup,
  restoreList,
  restoreTasks,
  serializeIndex,
  serializeTasks,
  setDone,
  smartList,
  sortedLists,
  splitDone,
  type Task,
  type TaskIndex,
  updateList,
  updateStep,
  updateTask,
  withRanks,
} from "./taskStore";

const T0 = "2026-06-01T10:00:00.000Z";
const T1 = "2026-06-01T11:00:00.000Z";
const mk = (id: string, title = id, now = T0): Task =>
  makeTask({ id, title, now });

test("parsing keeps what is good, drops what is not, and keeps keys it does not know", () => {
  const tasks = parseTasks({
    version: 2,
    tasks: [
      { id: "a", title: "A", done: true, due: "2026-12-01", future: { x: 1 } },
      { id: "a", title: "Again" }, // a repeated id: the first one stays
      { id: "../x", title: "unsafe id" },
      { id: "b" }, // no title
      "junk",
      {
        id: "c",
        title: "C",
        due: "tomorrow",
        important: "yes",
        order: Number.NaN,
        steps: [
          { id: "s1", title: "S", done: true },
          { id: "s1", title: "S" },
          3,
        ],
      },
    ],
  });
  assert.deepEqual(
    tasks.map((t) => t.id),
    ["a", "c"],
  );
  assert.equal(
    (tasks[0] as unknown as { future: unknown }).future !== undefined,
    true,
  );
  assert.equal(tasks[0].due, "2026-12-01");
  assert.equal(tasks[0].done, true);
  // bad values are dropped, not turned into something else
  assert.deepEqual(Object.keys(tasks[1]).sort(), [
    "createdAt",
    "done",
    "id",
    "steps",
    "title",
    "updatedAt",
  ]);
  assert.deepEqual(tasks[1].steps, [{ id: "s1", title: "S", done: true }]);

  for (const bad of [null, "x", [], 5, { tasks: "no" }, {}])
    assert.deepEqual(parseTasks(bad), []);

  // what goes out reads back the same
  assert.deepEqual(parseTasks(JSON.parse(serializeTasks(tasks))), tasks);
});

test("the index always has the default list, and its lists sit in groups that exist", () => {
  assert.deepEqual(parseIndex(undefined), {
    groups: [],
    lists: [{ id: DEFAULT_LIST_ID, name: "Tasks" }],
  });
  const index = parseIndex({
    groups: [
      { id: "g1", name: "Work" },
      { id: "g1", name: "dup" },
      { id: "index", name: "x" },
    ],
    lists: [
      { id: "l1", name: "Plans", groupId: "g1", color: "blue", order: 2048 },
      { id: "l2", name: "Lost", groupId: "gone", color: "pink" },
      { id: "index", name: "Clashes with index.json" },
      { id: "tasks", name: "My tasks" },
    ],
  });
  assert.deepEqual(index.groups, [{ id: "g1", name: "Work" }]);
  assert.deepEqual(index.lists, [
    { id: "l1", name: "Plans", groupId: "g1", color: "blue", order: 2048 },
    { id: "l2", name: "Lost" }, // unknown group and color are dropped
    { id: "tasks", name: "My tasks" },
  ]);
  assert.deepEqual(parseIndex(JSON.parse(serializeIndex(index))), index);
});

test("a new task shows on top, also in a list with a chosen order", () => {
  const a = mk("a", "A", "2026-06-01T10:00:00.000Z");
  const b = mk("b", "B", "2026-06-01T10:05:00.000Z");
  let tasks = addTask(addTask([], a), b);
  assert.deepEqual(
    splitDone(tasks).open.map((t) => t.id),
    ["b", "a"],
  ); // newest first
  assert.equal(addTask(tasks, a), tasks); // already there

  tasks = withRanks(tasks, { a: 1024, b: 2048 });
  assert.deepEqual(
    splitDone(tasks).open.map((t) => t.id),
    ["a", "b"],
  );
  tasks = addTask(tasks, mk("c", "C", "2026-06-01T10:10:00.000Z"));
  assert.deepEqual(
    splitDone(tasks).open.map((t) => t.id),
    ["c", "a", "b"],
  );

  // one that moves in from another list leaves its old rank behind
  const moved = addTask(tasks, { ...mk("d"), order: 99999 });
  assert.ok((moved[0].order ?? 0) < 1024);
});

test("update, done, remove", () => {
  let tasks = [mk("a", "Buy milk")];
  tasks = updateTask(
    tasks,
    "a",
    {
      title: "  Buy\n oat milk ",
      due: "2026-06-05",
      note: "2 cartons",
      important: true,
      myDay: "2026-06-01",
    },
    T1,
  );
  assert.deepEqual(
    [
      tasks[0].title,
      tasks[0].due,
      tasks[0].note,
      tasks[0].important,
      tasks[0].myDay,
      tasks[0].updatedAt,
    ],
    ["Buy oat milk", "2026-06-05", "2 cartons", true, "2026-06-01", T1],
  );
  // null (or false, or blank) takes a field off; a bad date or an empty title changes nothing
  tasks = updateTask(
    tasks,
    "a",
    { title: " ", due: "soon", note: "  ", important: false, myDay: null },
    T1,
  );
  assert.equal(tasks[0].title, "Buy oat milk");
  assert.equal(tasks[0].due, "2026-06-05");
  assert.ok(
    !("note" in tasks[0]) &&
      !("important" in tasks[0]) &&
      !("myDay" in tasks[0]),
  );
  assert.ok(!("due" in updateTask(tasks, "a", { due: null }, T1)[0]));
  assert.equal(updateTask(tasks, "nope", { title: "x" }, T1), tasks);

  const done = setDone(tasks, "a", true, T1);
  assert.deepEqual([done[0].done, done[0].doneAt], [true, T1]);
  assert.equal(setDone(done, "a", true, "later"), done); // nothing to change
  assert.ok(!("doneAt" in setDone(done, "a", false, T1)[0]));

  assert.deepEqual(removeTask(done, "a"), []);
  assert.equal(removeTask(done, "nope"), done);
});

test("steps", () => {
  let tasks = [mk("a")];
  tasks = addStep(tasks, "a", { id: "s1", title: " one ", done: false }, T1);
  tasks = addStep(tasks, "a", { id: "s2", title: "two", done: false }, T1);
  assert.deepEqual(
    tasks[0].steps.map((s) => s.title),
    ["one", "two"],
  );
  assert.equal(
    addStep(tasks, "a", { id: "s3", title: " ", done: false }, T1),
    tasks,
  );
  assert.equal(
    addStep(tasks, "a", { id: "s1", title: "again", done: false }, T1),
    tasks,
  );

  tasks = updateStep(tasks, "a", "s1", { done: true }, T1);
  tasks = updateStep(tasks, "a", "s2", { title: "second" }, T1);
  assert.deepEqual(tasks[0].steps, [
    { id: "s1", title: "one", done: true },
    { id: "s2", title: "second", done: false },
  ]);
  assert.equal(updateStep(tasks, "a", "nope", { done: true }, T1), tasks);
  assert.deepEqual(
    removeStep(tasks, "a", "s1", T1)[0].steps.map((s) => s.id),
    ["s2"],
  );
  assert.equal(removeStep(tasks, "a", "nope", T1), tasks);
});

test("lists and groups", () => {
  let index: TaskIndex = parseIndex(undefined);
  index = addGroup(index, { id: "g1", name: "Work" });
  index = addList(index, { id: "l1", name: "Plans" });
  index = addList(index, { id: "l2", name: "  " }); // no name, no list
  assert.deepEqual(
    index.lists.map((l) => l.id),
    ["tasks", "l1"],
  );
  assert.equal(addList(index, { id: "l1", name: "again" }), index);

  index = updateList(index, "l1", {
    name: "Roadmap",
    color: "green",
    groupId: "g1",
  });
  assert.deepEqual(index.lists[1], {
    id: "l1",
    name: "Roadmap",
    color: "green",
    groupId: "g1",
  });
  assert.equal(
    updateList(index, "l1", { groupId: "nope" }).lists[1].groupId,
    "g1",
  ); // no such group
  assert.ok(!("color" in updateList(index, "l1", { color: null }).lists[1]));
  assert.equal(updateList(index, "nope", { name: "x" }), index);
  assert.deepEqual(
    sortedLists(index, "g1").map((l) => l.id),
    ["l1"],
  );
  assert.deepEqual(
    sortedLists(index, null).map((l) => l.id),
    ["tasks"],
  );

  index = renameGroup(index, "g1", "Job");
  assert.equal(index.groups[0].name, "Job");
  assert.equal(renameGroup(index, "g1", " "), index);

  // a group goes, its lists stay; the default list cannot go
  const out = removeGroup(index, "g1");
  assert.deepEqual(out.groups, []);
  assert.deepEqual(out.lists[1], { id: "l1", name: "Roadmap", color: "green" });
  assert.equal(removeList(index, DEFAULT_LIST_ID), index);
  assert.deepEqual(
    removeList(index, "l1").lists.map((l) => l.id),
    ["tasks"],
  );
});

test("lists, groups and tasks take ranks from placeNear", () => {
  const index = parseIndex({
    groups: [],
    lists: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ],
  });
  // unranked lists show by name
  const shown = sortedLists(index, null);
  assert.deepEqual(
    shown.map((l) => l.id),
    ["a", "b", "c", "tasks"],
  );
  const ranks = placeNear(shown, "c", "a", false);
  const moved = withRanks(index.lists, ranks);
  assert.deepEqual(
    sortedLists({ groups: [], lists: moved }, null).map((l) => l.id),
    ["c", "a", "b", "tasks"],
  );

  const tasks = ["x", "y", "z"].map((id, i) =>
    mk(id, id, `2026-06-01T10:0${i}:00.000Z`),
  );
  const order = splitDone(tasks).open; // z, y, x
  const next = withRanks(tasks, placeNear(order, "x", "z", false));
  assert.deepEqual(
    splitDone(next).open.map((t) => t.id),
    ["x", "z", "y"],
  );
});

test("My Day empties itself overnight, Important does not; counts and Completed", () => {
  const lists = [
    { id: "l1", name: "L1" },
    { id: "l2", name: "L2" },
  ];
  const byList = {
    l1: [
      { ...mk("a"), myDay: "2026-06-01" },
      { ...mk("b"), myDay: "2026-05-31" }, // yesterday's
      { ...mk("c"), important: true, done: true, doneAt: T0 },
    ],
    l2: [{ ...mk("d"), myDay: "2026-06-01", important: true }],
  };
  const ids = (key: "my-day" | "important", today: string) =>
    smartList(key, lists, byList, today).map((p) => `${p.listId}:${p.task.id}`);
  assert.deepEqual(ids("my-day", "2026-06-01"), ["l1:a", "l2:d"]);
  assert.deepEqual(ids("my-day", "2026-06-02"), []);
  assert.deepEqual(ids("important", "2026-06-02"), ["l1:c", "l2:d"]);

  assert.equal(openCount(byList.l1), 2);
  const { open, done } = splitDone(byList.l1);
  assert.deepEqual([open.length, done.map((t) => t.id)], [2, ["c"]]);
});

test("dueStatus", () => {
  assert.equal(dueStatus("2026-01-01", "2026-06-01"), "overdue");
  assert.equal(dueStatus("2026-06-01", "2026-06-01"), "today");
  assert.equal(dueStatus("2026-12-01", "2026-06-01"), "later");
});

test("a deleted list comes back with its name, colour, rank, group and every task, ticked ones too", () => {
  const index: TaskIndex = parseIndex({
    groups: [{ id: "g1", name: "Work" }],
    lists: [
      { id: "l1", name: "Plan", color: "blue", groupId: "g1", order: 2048 },
      { id: "l2", name: "Other" },
    ],
  });
  const tasks = [
    { ...mk("a"), order: 5 },
    { ...mk("b"), done: true, doneAt: T1 },
  ];
  const list = index.lists.find((l) => l.id === "l1");
  assert.ok(list);
  const gone = removeList(index, "l1");
  assert.deepEqual(restoreList(gone, list), {
    ...gone,
    lists: [...gone.lists, list],
  });
  // the same entry, not a rebuilt one: nothing is lost on the way
  const back = restoreList(gone, list);
  assert.equal(back.lists[back.lists.length - 1], list);
  // the tasks are written back whole, ranks and done state included
  assert.deepEqual(restoreTasks([], tasks), tasks);
});

test("restoring a list that exists again does nothing, and a list whose group went lands outside any group", () => {
  const index = parseIndex({
    groups: [{ id: "g1", name: "Work" }],
    lists: [{ id: "l1", name: "Plan", groupId: "g1" }],
  });
  const list = index.lists.find((l) => l.id === "l1");
  assert.ok(list);
  assert.equal(restoreList(index, list), index);
  const noGroup = removeList(removeGroup(index, "g1"), "l1");
  const back = restoreList(noGroup, list);
  assert.equal(back.lists[back.lists.length - 1]?.groupId, undefined);
  assert.equal(back.lists[back.lists.length - 1]?.name, "Plan");
});

test("restored tasks are merged with what the file holds: none twice, none dropped", () => {
  const snapshot = [mk("a"), mk("b")];
  const now = [mk("b", "b edited"), mk("c")];
  assert.deepEqual(
    restoreTasks(now, snapshot).map((t) => t.id),
    ["b", "c", "a"],
  );
  assert.equal(restoreTasks(now, snapshot)[0].title, "b edited");
  // nothing to add: the same array comes back, so nothing is written
  assert.equal(restoreTasks(snapshot, snapshot), snapshot);
  assert.equal(restoreTasks(now, []), now);
});

test("a deleted group comes back with its rank and takes its lists back, unless they went elsewhere", () => {
  const index = parseIndex({
    groups: [
      { id: "g1", name: "Work", order: 1024 },
      { id: "g2", name: "Home" },
    ],
    lists: [
      { id: "l1", name: "A", groupId: "g1", order: 1 },
      { id: "l2", name: "B", groupId: "g1" },
      { id: "l3", name: "C", groupId: "g1" },
    ],
  });
  const group = index.groups.find((g) => g.id === "g1");
  assert.ok(group);
  const listIds = index.lists
    .filter((l) => l.groupId === "g1")
    .map((l) => l.id);
  let gone = removeGroup(index, "g1");
  assert.ok(gone.lists.every((l) => l.groupId === undefined));
  // meanwhile: l2 is moved to another group and l3 is deleted
  gone = updateList(gone, "l2", { groupId: "g2" });
  gone = removeList(gone, "l3");
  const back = restoreGroup(gone, group, listIds);
  assert.equal(back.groups.find((g) => g.id === "g1")?.order, 1024);
  assert.equal(back.lists.find((l) => l.id === "l1")?.groupId, "g1");
  assert.equal(back.lists.find((l) => l.id === "l1")?.order, 1);
  assert.equal(back.lists.find((l) => l.id === "l2")?.groupId, "g2");
  assert.equal(
    back.lists.some((l) => l.id === "l3"),
    false,
  );
  // a group that is there again is left alone
  assert.equal(restoreGroup(back, group, listIds), back);
});
