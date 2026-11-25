// src/components/ui/Calendar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  daysIntoWeek,
  monthGrid,
  weekStartOf,
} from "../../lib/calendar";
import { nextDay } from "../../lib/taskDates";
import Button from "./Button";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icon";
import IconButton from "./IconButton";

interface CalendarProps {
  /** The picked day (YYYY-MM-DD), or "" for none */
  value: string;
  today: string;
  /** The day that was chosen, or null when Clear was */
  onPick: (day: string | null) => void;
}

const dayAt = (day: string) => new Date(`${day}T00:00:00`);
const monthTitle = (day: string) =>
  dayAt(day).toLocaleDateString(undefined, { month: "long", year: "numeric" });
const dayName = (day: string) =>
  dayAt(day).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/**
 * A month of days to pick from, with Today, Tomorrow and Clear under it. One day at a time has the keyboard (the others are
 * out of the tab order): the arrow keys move it by a day or a week, Page Up and Page Down by a month (with Shift a year), Home
 * and End to the ends of the week, Enter picks it.
 */
function Calendar({ value, today, onPick }: CalendarProps) {
  // The day the keyboard is on. It decides which month is shown
  const [at, setAt] = useState(value || today);
  const grid = useRef<HTMLTableElement>(null);
  const weekStart = useMemo(() => weekStartOf(), []);
  const month = at.slice(0, 7);
  const weeks = useMemo(
    () => monthGrid(`${month}-01`, weekStart),
    [month, weekStart],
  );

  // A move by key hands the focus to the new day once it has rendered (the month may have changed under it)
  const follow = useRef(true); // the first render too: the calendar opens with the focus on its day
  // biome-ignore lint/correctness/useExhaustiveDependencies: `at` is the trigger
  useEffect(() => {
    if (!follow.current) return;
    follow.current = false;
    grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [at]);

  const move = (to: string) => {
    follow.current = true;
    setAt(to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const jump = e.shiftKey ? 12 : 1;
    const to: Record<string, string> = {
      ArrowLeft: addDays(at, -1),
      ArrowRight: addDays(at, 1),
      ArrowUp: addDays(at, -7),
      ArrowDown: addDays(at, 7),
      PageUp: addMonths(at, -jump),
      PageDown: addMonths(at, jump),
      Home: addDays(at, -daysIntoWeek(at, weekStart)),
      End: addDays(at, 6 - daysIntoWeek(at, weekStart)),
    };
    if (!(e.key in to)) return;
    e.preventDefault();
    move(to[e.key]);
  };

  return (
    <div className="calendar">
      <div className="calendar__head">
        <IconButton
          aria-label="Previous month"
          onClick={() => setAt(addMonths(at, -1))}
        >
          <ChevronLeftIcon size={14} />
        </IconButton>
        <span className="calendar__title" aria-live="polite">
          {monthTitle(at)}
        </span>
        <IconButton
          aria-label="Next month"
          onClick={() => setAt(addMonths(at, 1))}
        >
          <ChevronRightIcon size={14} />
        </IconButton>
      </div>

      <table
        ref={grid}
        className="calendar__grid"
        aria-label={monthTitle(at)}
        onKeyDown={onKeyDown}
      >
        <thead>
          <tr>
            {weeks[0].map((day) => (
              <th
                key={day}
                scope="col"
                abbr={dayAt(day).toLocaleDateString(undefined, {
                  weekday: "long",
                })}
                className="calendar__name"
              >
                {dayAt(day).toLocaleDateString(undefined, { weekday: "short" })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => (
                <td key={day}>
                  <button
                    type="button"
                    tabIndex={day === at ? 0 : -1}
                    aria-pressed={day === value}
                    aria-current={day === today ? "date" : undefined}
                    aria-label={dayName(day)}
                    className={`calendar__day${day.startsWith(month) ? "" : " calendar__day--outside"}${day === today ? " calendar__day--today" : ""}${day === value ? " calendar__day--picked" : ""}`}
                    onClick={() => onPick(day)}
                  >
                    {Number(day.slice(8))}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="calendar__foot">
        <Button variant="quiet" size="sm" onClick={() => onPick(today)}>
          Today
        </Button>
        <Button
          variant="quiet"
          size="sm"
          onClick={() => onPick(nextDay(today))}
        >
          Tomorrow
        </Button>
        {value && (
          <Button
            variant="quiet"
            size="sm"
            className="calendar__clear"
            onClick={() => onPick(null)}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

export default Calendar;
