// src/lib/rescanGate.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { RESCAN_MIN_MS, rescanDue } from "./rescanGate";

test("a rescan is due once five seconds have passed since the last one started", () => {
  assert.equal(RESCAN_MIN_MS, 5000);
  assert.equal(rescanDue(1000, 1000), false); // a second focus event of the same restore
  assert.equal(rescanDue(1000, 5999), false);
  assert.equal(rescanDue(1000, 6000), true);
  assert.equal(rescanDue(1000, 60000), true);
});
