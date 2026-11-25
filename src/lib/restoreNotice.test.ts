// src/lib/restoreNotice.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { restoreNotice } from "./restoreNotice";

test("a note put back in its folder says which one, with the folder's whole path", () => {
  assert.equal(
    restoreNotice("Plan", "Work", "Work"),
    'Restored "Plan" to Work',
  );
  assert.equal(
    restoreNotice("Plan", "Work/Specs", "Work/Specs"),
    'Restored "Plan" to Work / Specs',
  );
});

test("a note that had no folder goes to the top level", () => {
  assert.equal(
    restoreNotice("Plan", null, null),
    'Restored "Plan" to the top level',
  );
});

test("when its folder is gone it lands at the top level and the toast says why, naming the folder", () => {
  assert.equal(
    restoreNotice("Plan", "Work/Specs", null),
    'Restored "Plan" to the top level because Work / Specs no longer exists',
  );
});

test("an untitled note still has a name in the toast", () => {
  assert.equal(
    restoreNotice("  ", null, null),
    'Restored "Untitled" to the top level',
  );
});
