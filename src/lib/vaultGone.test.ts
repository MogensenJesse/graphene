// src/lib/vaultGone.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { hasUnsavedWork, shownWhenGone, type UnsavedWork } from "./vaultGone";

const none: UnsavedWork = {
  editorDirty: false,
  failedNotes: 0,
  failedTasks: 0,
  writing: false,
  taskFieldOpen: false,
};

test("a vault that is gone with nothing unsaved shows VaultUnavailable", () => {
  assert.ok(!hasUnsavedWork(none));
  assert.equal(shownWhenGone("ok", none), "unavailable");
});

test("any edit that only lives in memory keeps the app and shows the notice", () => {
  for (const work of [
    { ...none, editorDirty: true },
    { ...none, failedNotes: 1 },
    { ...none, failedTasks: 2 },
    { ...none, writing: true },
    { ...none, taskFieldOpen: true },
  ]) {
    assert.ok(hasUnsavedWork(work));
    assert.equal(shownWhenGone("ok", work), "notice");
  }
});

test("what is showing stays: the notice never gives way to VaultUnavailable with edits behind it", () => {
  assert.equal(shownWhenGone("notice", none), "notice");
  assert.equal(
    shownWhenGone("notice", { ...none, editorDirty: true }),
    "notice",
  );
  assert.equal(shownWhenGone("unavailable", none), "unavailable");
  assert.equal(
    shownWhenGone("unavailable", { ...none, editorDirty: true }),
    "unavailable",
  );
});
