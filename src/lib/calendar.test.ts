// src/lib/calendar.test.ts
import { expect, test } from "vitest";
import {
  addDays,
  addMonths,
  daysIntoWeek,
  monthGrid,
  weekdayOf,
  weekStartFrom,
} from "./calendar";

test("addDays crosses month and year ends and a leap day", () => {
  expect(addDays("2026-11-25", 1)).toBe("2026-11-26");
  expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  expect(addDays("2026-03-29", 7)).toBe("2026-04-05"); // over a clock change
  expect(addDays("2026-11-25", 0)).toBe("2026-11-25");
});

test("addMonths keeps the date, or the last day of a shorter month", () => {
  expect(addMonths("2026-11-25", 1)).toBe("2026-12-25");
  expect(addMonths("2026-12-25", 1)).toBe("2027-01-25");
  expect(addMonths("2026-01-25", -1)).toBe("2025-12-25");
  expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
  expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
  expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  expect(addMonths("2026-11-25", 12)).toBe("2027-11-25");
  expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
});

test("weekdays count from Sunday as 0", () => {
  expect(weekdayOf("2026-11-22")).toBe(0); // a Sunday
  expect(weekdayOf("2026-11-25")).toBe(3); // a Wednesday
  expect(daysIntoWeek("2026-11-25", 1)).toBe(2); // Monday-first: Wednesday is two days in
  expect(daysIntoWeek("2026-11-25", 0)).toBe(3);
  expect(daysIntoWeek("2026-11-22", 1)).toBe(6); // a Sunday ends a Monday week
});

test("a month grid is six whole weeks, starting on the week start", () => {
  // February 2028 begins on a Tuesday and has 29 days
  const monday = monthGrid("2028-02-10", 1);
  expect(monday).toHaveLength(6);
  expect(monday.every((week) => week.length === 7)).toBe(true);
  expect(monday[0][0]).toBe("2028-01-31"); // the Monday before the 1st
  expect(monday[0][1]).toBe("2028-02-01");
  expect(monday[4][1]).toBe("2028-02-29");
  expect(monday[5][6]).toBe("2028-03-12");

  const sunday = monthGrid("2028-02-10", 0);
  expect(sunday[0][0]).toBe("2028-01-30");
  expect(sunday[0][2]).toBe("2028-02-01");
});

test("a month that begins on the week start has no days before it", () => {
  // 1 June 2026 is a Monday
  expect(monthGrid("2026-06-15", 1)[0][0]).toBe("2026-06-01");
  // and a Sunday week puts the 1st on the second day, with the 31 May before it
  expect(monthGrid("2026-06-15", 0)[0][0]).toBe("2026-05-31");
});

test("the grid has every day of the month, once, in order", () => {
  const days = monthGrid("2026-02-14", 1).flat();
  expect(new Set(days).size).toBe(42);
  expect(days.filter((d) => d.startsWith("2026-02"))).toHaveLength(28);
  expect([...days].sort()).toEqual(days);
});

test("the week start follows what the system reports, and is Monday without it", () => {
  expect(weekStartFrom({ firstDay: 1 })).toBe(1); // Monday
  expect(weekStartFrom({ firstDay: 7 })).toBe(0); // Sunday
  expect(weekStartFrom({ firstDay: 6 })).toBe(6); // Saturday
  expect(weekStartFrom(undefined)).toBe(1);
});
