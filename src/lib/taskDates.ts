// src/lib/taskDates.ts
// How a task's day is written on screen. Days are YYYY-MM-DD strings (see taskStore), compared as calendar days.

const DAY_MS = 86_400_000;
const utcDay = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** "Today", "Tomorrow", "Yesterday", a weekday within the coming week, else "3 Dec" (with the year when it is another one). */
export function dueLabel(date: string, today: string): string {
  const diff = Math.round((utcDay(date) - utcDay(today)) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const d = new Date(`${date}T00:00:00`);
  if (diff > 1 && diff < 7)
    return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: date.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
  });
}

/** The heading of My Day: "Friday, 20 November". */
export function longDay(today: string): string {
  return new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
