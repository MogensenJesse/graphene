// src/lib/calendar.ts
// Day arithmetic and month grids for the date picker. Days are YYYY-MM-DD strings (see taskStore); the sums are done in UTC, so a
// change of summer time never moves a day. Weekdays are numbered as Date does: 0 is Sunday, 6 is Saturday.

const DAY_MS = 86_400_000;
const utcDay = (day: string) => Date.parse(`${day}T00:00:00Z`);
const asDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The day `n` days from `day` (negative for before). */
export const addDays = (day: string, n: number): string =>
  asDay(utcDay(day) + n * DAY_MS);

/** The same date `n` months on, or the last day of that month when it has no such date (31 January + 1 month is 28 or 29 February). */
export function addMonths(day: string, n: number): string {
  const month = Number(day.slice(5, 7)) - 1 + n;
  const year = Number(day.slice(0, 4));
  const lastDate = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const date = Math.min(Number(day.slice(8, 10)), lastDate);
  return asDay(Date.UTC(year, month, date));
}

export const weekdayOf = (day: string): number =>
  new Date(utcDay(day)).getUTCDay();

/** How many days `day` is after the start of its week. */
export const daysIntoWeek = (day: string, weekStart: number): number =>
  (weekdayOf(day) - weekStart + 7) % 7;

/**
 * The six weeks that show the month `day` is in: always 42 days, so the calendar does not change height from month to month,
 * with the last days of the month before and the first of the month after filling the ends.
 */
export function monthGrid(day: string, weekStart: number): string[][] {
  const first = `${day.slice(0, 7)}-01`;
  const start = addDays(first, -daysIntoWeek(first, weekStart));
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, d) => addDays(start, week * 7 + d)),
  );
}

/** The first weekday of a locale's week, from what `Intl.Locale` says (`firstDay` is 1 for Monday to 7 for Sunday). Monday when unknown. */
export const weekStartFrom = (info?: { firstDay: number }): number =>
  info ? info.firstDay % 7 : 1;

/** The first day of the week the user's system uses. */
export function weekStartOf(locale: string = navigator.language): number {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    return weekStartFrom(l.getWeekInfo?.() ?? l.weekInfo);
  } catch {
    return 1;
  }
}
