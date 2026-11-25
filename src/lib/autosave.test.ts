// src/lib/autosave.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  AUTOSAVE_DELAY_MS,
  AUTOSAVE_MAX_WAIT_MS,
  autosaveDelay,
} from "./autosave";

test("a quiet editor saves after the debounce delay", () => {
  assert.equal(autosaveDelay(1000, 1000), AUTOSAVE_DELAY_MS);
  assert.equal(autosaveDelay(1000, 3000), AUTOSAVE_DELAY_MS);
});

test("a long burst is cut at the max wait after the first unsaved edit", () => {
  const since = 50_000;
  // 300 ms before the deadline: the deadline wins over the full delay
  assert.equal(autosaveDelay(since, since + AUTOSAVE_MAX_WAIT_MS - 300), 300);
  // at and past the deadline: save at once, never a negative delay
  assert.equal(autosaveDelay(since, since + AUTOSAVE_MAX_WAIT_MS), 0);
  assert.equal(autosaveDelay(since, since + AUTOSAVE_MAX_WAIT_MS + 5000), 0);
});

test("keystrokes 100 ms apart save about every max wait, not never", () => {
  // The editor re-arms the timer after every keystroke with this delay; the first timer that fires is the save
  const since = 0;
  let now = since;
  let saved: number | null = null;
  for (; now < 30_000 && saved === null; now += 100) {
    const wait = autosaveDelay(since, now);
    if (wait < 100) saved = now + wait; // fires before the next keystroke re-arms it
  }
  assert.ok(saved !== null && saved <= AUTOSAVE_MAX_WAIT_MS);
});
