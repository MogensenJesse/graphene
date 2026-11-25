// src/lib/focusTrap.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { tabTarget } from "./focusTrap";

test("Tab inside the dialog is left to the browser", () => {
  assert.equal(tabTarget(4, 0, false), null);
  assert.equal(tabTarget(4, 1, false), null);
  assert.equal(tabTarget(4, 2, true), null);
  assert.equal(tabTarget(4, 3, true), null);
});

test("Tab on the last control wraps to the first, Shift+Tab on the first to the last", () => {
  assert.equal(tabTarget(4, 3, false), 0);
  assert.equal(tabTarget(4, 0, true), 3);
});

test("a dialog with one control keeps the focus on it in both directions", () => {
  assert.equal(tabTarget(1, 0, false), 0);
  assert.equal(tabTarget(1, 0, true), 0);
});

test("focus on the frame or the page goes to the first control, or the last backwards", () => {
  assert.equal(tabTarget(4, -1, false), 0);
  assert.equal(tabTarget(4, -1, true), 3);
});

test("a dialog with no control keeps the focus on its frame", () => {
  assert.equal(tabTarget(0, -1, false), "panel");
  assert.equal(tabTarget(0, -1, true), "panel");
});
