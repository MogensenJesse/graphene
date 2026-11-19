// src/lib/tasks.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { activeFormats, continueTask, formatText } from "./markdownFormat";
import {
  dueStatus,
  isTodoBody,
  listTasks,
  moveTask,
  setTaskDone,
  taskProgress,
  toggleTaskAt,
} from "./tasks";

test("listTasks and setTaskDone number tasks by line and skip code fences", () => {
  const body =
    "# T\n- [ ] a due:2026-12-01\n  - [x] b\n```\n- [ ] fenced\n```\n1. [ ] c\r\n";
  const tasks = listTasks(body);
  assert.deepEqual(
    tasks.map((t) => [t.line, t.done, t.text, t.due]),
    [
      [2, false, "a due:2026-12-01", "2026-12-01"],
      [3, true, "b", null],
      [7, false, "c", null], // the fenced one is not a task
    ],
  );
  assert.equal(setTaskDone(body, 2, true), body.replace("- [ ] a", "- [x] a"));
  assert.equal(setTaskDone(body, 3, false), body.replace("- [x] b", "- [ ] b"));
  assert.equal(setTaskDone(body, 2, false), body); // already open
  assert.equal(setTaskDone(body, 5, true), null); // inside the fence
  assert.equal(setTaskDone(body, 1, true), null); // a heading
});

test("task lists and to-do notes", () => {
  // ── toggleTaskAt ──
  const body = "# T\n- [ ] a\n  - [x] b\n1. [ ] c\n```\n- [ ] fenced\n```\n";
  const offA = body.indexOf("- [ ] a");
  assert.equal(toggleTaskAt(body, offA), body.replace("- [ ] a", "- [x] a"));
  const offB = body.indexOf("- [x] b");
  assert.equal(toggleTaskAt(body, offB), body.replace("- [x] b", "- [ ] b"));
  const offC = body.indexOf("1. [ ] c");
  assert.equal(toggleTaskAt(body, offC), body.replace("1. [ ] c", "1. [x] c"));
  assert.equal(toggleTaskAt(body, 0), null); // heading, not a task
  assert.equal(toggleTaskAt(body, offA + 1), null); // stale offset
  const crlf = "- [ ] a\r\n- [ ] b\r\n";
  assert.equal(
    toggleTaskAt(crlf, crlf.indexOf("- [ ] b")),
    "- [ ] a\r\n- [x] b\r\n",
  );
  assert.equal(toggleTaskAt("- [ ]", 0), "- [x]");

  // ── taskProgress ──
  assert.deepEqual(taskProgress(body), { done: 1, total: 3 }); // fenced one ignored
  assert.deepEqual(taskProgress(""), { done: 0, total: 0 });
  assert.deepEqual(taskProgress("- [X] a\n- [ ] b\r\n- plain\n"), {
    done: 1,
    total: 2,
  });
  assert.deepEqual(taskProgress("~~~\n- [ ] x\n~~~\n- [ ] y"), {
    done: 0,
    total: 1,
  });

  // ── isTodoBody ──
  assert.equal(isTodoBody("- [ ] a"), true);
  assert.equal(isTodoBody("- [ ] "), true); // the seed
  assert.equal(isTodoBody("\n\n# Groceries\n\n- [x] milk"), true);
  assert.equal(isTodoBody("intro\n- [ ] a"), false);
  assert.equal(isTodoBody("- plain\n- [ ] a"), false);
  assert.equal(isTodoBody("```js\nx\n```\n- [ ] a"), false);
  assert.equal(isTodoBody(""), false);
  assert.equal(isTodoBody("- [ ]\r\n"), true);

  // ── dueStatus ──
  assert.equal(dueStatus("2026-01-01", "2026-06-01"), "overdue");
  assert.equal(dueStatus("2026-06-01", "2026-06-01"), "today");
  assert.equal(dueStatus("2026-12-01", "2026-06-01"), "later");

  // ── moveTask ──
  const list = "- [ ] a\n- [ ] b\n  - [ ] b1\n- [ ] c";
  const at = (s: string) => list.indexOf(s);
  // c before a
  assert.equal(
    moveTask(list, at("- [ ] c"), at("- [ ] a"), false),
    "- [ ] c\n- [ ] a\n- [ ] b\n  - [ ] b1",
  );
  // a after b (takes b's child block into account)
  assert.equal(
    moveTask(list, at("- [ ] a"), at("- [ ] b"), true),
    "- [ ] b\n  - [ ] b1\n- [ ] a\n- [ ] c",
  );
  // b (with child) after c
  assert.equal(
    moveTask(list, at("- [ ] b"), at("- [ ] c"), true),
    "- [ ] a\n- [ ] c\n- [ ] b\n  - [ ] b1",
  );
  // into b's children level: a before b1 gets indented
  assert.equal(
    moveTask(list, at("- [ ] a"), at("- [ ] b1"), false),
    "- [ ] b\n  - [ ] a\n  - [ ] b1\n- [ ] c",
  );
  // b1 before a: outdented
  assert.equal(
    moveTask(list, at("- [ ] b1"), at("- [ ] a"), false),
    "- [ ] b1\n- [ ] a\n- [ ] b\n- [ ] c".replace("- [ ] b1\n", "- [ ] b1\n"),
  );
  // own descendant / same place / non-task: nothing
  assert.equal(moveTask(list, at("- [ ] b"), at("- [ ] b1"), true), null);
  assert.equal(moveTask(list, at("- [ ] a"), at("- [ ] b"), false), null);
  assert.equal(moveTask(list, at("- [ ] b"), at("- [ ] a"), true), null);
  assert.equal(moveTask(list, 1, at("- [ ] b"), true), null);

  // ── formats ──
  assert.equal(formatText("buy milk", 0, 0, "task").value, "- [ ] buy milk");
  assert.equal(formatText("- [ ] buy milk", 3, 3, "task").value, "buy milk");
  assert.equal(formatText("- [x] buy milk", 3, 3, "task").value, "buy milk");
  assert.equal(formatText("- buy milk", 2, 2, "task").value, "- [ ] buy milk");
  assert.equal(formatText("- [ ] buy milk", 3, 3, "ul").value, "- buy milk"); // task becomes a bullet
  assert.equal(formatText("- buy milk", 2, 2, "ul").value, "buy milk"); // plain bullet still toggles off
  assert.equal(formatText("milk", 0, 0, "ul").value, "- milk");
  assert.ok(!activeFormats("- [ ] a", 4, 4).has("ul"));
  assert.ok(activeFormats("- [ ] a", 4, 4).has("task"));
  assert.ok(activeFormats("- a", 2, 2).has("ul"));
  assert.ok(!activeFormats("- a", 2, 2).has("task"));

  // ── continueTask ──
  let v = "- [ ] a";
  let r = continueTask(v, v.length, v.length);
  assert.equal(r?.value, "- [ ] a\n- [ ] ");
  assert.equal(r?.ss, r?.value.length);
  v = "  - [x] done";
  r = continueTask(v, v.length, v.length);
  assert.equal(r?.value, "  - [x] done\n  - [ ] ");
  v = "1. [ ] one";
  assert.equal(
    continueTask(v, v.length, v.length)?.value,
    "1. [ ] one\n2. [ ] ",
  );
  v = "x\n- [ ] ";
  r = continueTask(v, v.length, v.length);
  assert.equal(r?.value, "x\n"); // empty task clears
  assert.equal(r?.ss, 2);
  v = "- [ ] foobar";
  r = continueTask(v, 9, 9);
  assert.equal(r?.value, "- [ ] foo\n- [ ] bar");
  assert.equal(r?.ss, "- [ ] foo\n- [ ] ".length);
  assert.equal(continueTask("- [ ] a", 2, 2), null); // caret inside the marker
  assert.equal(continueTask("- a", 3, 3), null); // plain bullet: normal Enter
  assert.equal(continueTask("- [ ] abc", 4, 7), null); // selection
});
