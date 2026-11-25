// src/lib/tasks.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  activeFormats,
  continueList,
  formatText,
  shiftListIndent,
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

test("shiftListIndent is the editor Tab on a list line", () => {
  let r = shiftListIndent("- [ ] a\n- [ ] b", 12, 12, false);
  assert.equal(r?.value, "- [ ] a\n  - [ ] b");
  assert.equal(r?.ss, 14);
  r = shiftListIndent("- [ ] a\n    - [ ] b", 19, 19, true);
  assert.equal(r?.value, "- [ ] a\n  - [ ] b");
  assert.equal(r?.ss, 17);
  assert.equal(shiftListIndent("- [ ] a", 3, 3, true), null); // nothing to take out
  assert.equal(shiftListIndent("- [ ] a\n- [ ] b", 3, 12, false), null); // several lines

  // a plain bullet nests by 2, and comes back out
  r = shiftListIndent("- a\n- b", 7, 7, false);
  assert.equal(r?.value, "- a\n  - b");
  assert.equal(r?.ss, 9);
  assert.equal(shiftListIndent("- a\n  - b", 9, 9, true)?.value, "- a\n- b");
  // a number nests by the marker's width plus one (CommonMark: under `1. a` only from 3 spaces)
  r = shiftListIndent("1. a\n2. b", 9, 9, false);
  assert.equal(r?.value, "1. a\n   2. b");
  assert.equal(r?.ss, 12);
  r = shiftListIndent("1. a\n   2. b", 12, 12, true);
  assert.equal(r?.value, "1. a\n2. b");
  assert.equal(r?.ss, 9);
  assert.equal(shiftListIndent("10. a", 5, 5, false)?.value, "    10. a");
  // not a list line: normal Tab
  assert.equal(shiftListIndent("abc", 3, 3, false), null);
  assert.equal(shiftListIndent("- - -", 5, 5, false), null); // a rule
  assert.equal(shiftListIndent("1.", 2, 2, false), null); // no text after the marker
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

test("continueList carries a task onto the next line", () => {
  let v = "- [ ] a";
  let r = continueList(v, v.length, v.length);
  assert.equal(r?.value, "- [ ] a\n- [ ] ");
  assert.equal(r?.ss, r?.value.length);
  v = "  - [x] done";
  r = continueList(v, v.length, v.length);
  assert.equal(r?.value, "  - [x] done\n  - [ ] ");
  v = "1. [ ] one";
  assert.equal(
    continueList(v, v.length, v.length)?.value,
    "1. [ ] one\n2. [ ] ",
  );
  v = "x\n- [ ] ";
  r = continueList(v, v.length, v.length);
  assert.equal(r?.value, "x\n"); // empty task clears
  assert.equal(r?.ss, 2);
  v = "- [ ] foobar";
  r = continueList(v, 9, 9);
  assert.equal(r?.value, "- [ ] foo\n- [ ] bar");
  assert.equal(r?.ss, "- [ ] foo\n- [ ] ".length);
  assert.equal(continueList("- [ ] a", 2, 2), null); // caret inside the marker
  assert.equal(continueList("- [ ] abc", 4, 7), null); // selection
});

test("continueList carries a bullet or a number onto the next line", () => {
  assert.equal(continueList("- a", 3, 3)?.value, "- a\n- ");
  assert.equal(continueList("* a", 3, 3)?.value, "* a\n* ");
  assert.equal(continueList("+ a", 3, 3)?.value, "+ a\n+ ");
  assert.equal(continueList("1. a", 4, 4)?.value, "1. a\n2. ");
  assert.equal(continueList("1) a", 4, 4)?.value, "1) a\n2) ");
  assert.equal(continueList("9. a", 4, 4)?.value, "9. a\n10. ");
  assert.equal(continueList("  - a", 5, 5)?.value, "  - a\n  - "); // the indent is kept
  assert.equal(continueList("-   a", 5, 5)?.value, "-   a\n-   "); // so is the gap
  let v = "x\n- a";
  let r = continueList(v, v.length, v.length);
  assert.equal(r?.value, "x\n- a\n- ");
  assert.equal(r?.ss, r?.value.length); // the caret lands after the new marker

  // text after the caret moves down with the new marker
  r = continueList("- foobar", 5, 5);
  assert.equal(r?.value, "- foo\n- bar");
  assert.equal(r?.ss, "- foo\n- ".length);

  // Enter on an empty item ends the list: the line is cleared, indent and all
  v = "x\n- ";
  r = continueList(v, v.length, v.length);
  assert.equal(r?.value, "x\n");
  assert.equal(r?.ss, 2);
  v = "1. a\n2. ";
  assert.equal(continueList(v, v.length, v.length)?.value, "1. a\n");
  v = "- a\n  - ";
  assert.equal(continueList(v, v.length, v.length)?.value, "- a\n");

  // normal Enter: caret inside the marker, a selection, no list, a rule, a marker with no text
  assert.equal(continueList("- a", 1, 1), null);
  assert.equal(continueList("- abc", 3, 4), null);
  assert.equal(continueList("abc", 3, 3), null);
  assert.equal(continueList("- - -", 5, 5), null);
  assert.equal(continueList("* * *", 5, 5), null);
  assert.equal(continueList("1.", 2, 2), null);
  assert.equal(continueList("-a", 2, 2), null);
});
