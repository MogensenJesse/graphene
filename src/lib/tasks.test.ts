// src/lib/tasks.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  activeFormats,
  continueTask,
  formatText,
  shiftTaskIndent,
} from "./markdownFormat";
import { toggleTaskAt } from "./tasks";

test("toggleTaskAt flips a checkbox by offset", () => {
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
});

test("shiftTaskIndent is the editor Tab on a task line", () => {
  let r = shiftTaskIndent("- [ ] a\n- [ ] b", 12, 12, false);
  assert.equal(r?.value, "- [ ] a\n  - [ ] b");
  assert.equal(r?.ss, 14);
  r = shiftTaskIndent("- [ ] a\n    - [ ] b", 19, 19, true);
  assert.equal(r?.value, "- [ ] a\n  - [ ] b");
  assert.equal(r?.ss, 17);
  assert.equal(shiftTaskIndent("- [ ] a", 3, 3, true), null); // nothing to take out
  assert.equal(shiftTaskIndent("- a", 3, 3, false), null); // a plain bullet: normal Tab
  assert.equal(shiftTaskIndent("- [ ] a\n- [ ] b", 3, 12, false), null); // several lines
});

test("the task button and ul format toggle between each other", () => {
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
});

test("continueTask carries a task onto the next line", () => {
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
