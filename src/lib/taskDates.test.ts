// src/lib/taskDates.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { dueLabel, nextDay } from "./taskDates";

test("nextDay steps over month, year and leap-day ends by calendar days", () => {
  assert.equal(nextDay("2026-11-20"), "2026-11-21");
  assert.equal(nextDay("2026-11-30"), "2026-12-01");
  assert.equal(nextDay("2026-12-31"), "2027-01-01");
  assert.equal(nextDay("2028-02-28"), "2028-02-29");
  assert.equal(nextDay("2027-02-28"), "2027-03-01");
});

test("dueLabel names the days around today and leaves the rest to the locale", () => {
  const today = "2026-11-20";
  assert.equal(dueLabel("2026-11-20", today), "Today");
  assert.equal(dueLabel("2026-11-21", today), "Tomorrow");
  assert.equal(dueLabel("2026-11-19", today), "Yesterday");
  // across a month and a year end, by calendar days
  assert.equal(dueLabel("2026-12-01", "2026-11-30"), "Tomorrow");
  assert.equal(dueLabel("2027-01-01", "2026-12-31"), "Tomorrow");
  // the rest is the locale's: a weekday within the week, else a date; only the year is checked
  assert.ok(dueLabel("2026-12-24", today).length > 0);
  assert.ok(dueLabel("2027-03-05", today).includes("2027"));
  assert.ok(!dueLabel("2026-12-24", today).includes("2026"));
});
