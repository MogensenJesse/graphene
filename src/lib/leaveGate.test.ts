// src/lib/leaveGate.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { leaveGate } from "./leaveGate";

test("everything saved: go on, nothing to warn about", () => {
  assert.deepEqual(leaveGate(true, false), { go: true, warned: false });
});

test("a failed write holds the first attempt back, the second goes through", () => {
  const first = leaveGate(false, false);
  assert.deepEqual(first, { go: false, warned: true });
  assert.deepEqual(leaveGate(false, first.warned), { go: true, warned: false });
});

test("once going on, the next failure holds the next attempt back again", () => {
  let warned = leaveGate(false, false).warned; // held back
  warned = leaveGate(true, warned).warned; // fixed meanwhile: goes on and forgets
  assert.equal(leaveGate(false, warned).go, false);
});
