// src/components/ui/DatePick.tsx
import { type ReactNode, useRef } from "react";
import Tooltip from "./Tooltip";

interface DatePickProps {
  /** YYYY-MM-DD, or "" for none */
  value: string;
  /** The picked day, or null when the picker's Clear was used */
  onChange: (date: string | null) => void;
  label: string;
  className?: string;
  children: ReactNode;
}

// The invisible input of the last pickDate, removed by the next one
let floating: HTMLInputElement | null = null;

/**
 * Opens the system's date picker beside `anchor` (a row, say) for a menu entry, which has no button to put the invisible input
 * under. `onPick` gets the day, or null when the picker's Clear was used. The input is made for the pick and removed by the next.
 */
export function pickDate(
  anchor: Element | null,
  value: string,
  onPick: (date: string | null) => void,
): void {
  floating?.remove();
  const input = document.createElement("input");
  input.type = "date";
  input.className = "date-pick__input date-pick__input--floating";
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.value = value;
  const at = anchor?.getBoundingClientRect();
  input.style.left = `${at?.left ?? 0}px`;
  input.style.top = `${at?.bottom ?? 0}px`;
  input.addEventListener("change", () => onPick(input.value || null));
  document.body.append(input);
  floating = input;
  // After the menu has closed and handed the focus back (the picker would otherwise lose it to that)
  setTimeout(() => {
    try {
      input.showPicker();
    } catch {
      input.remove(); // no picker to show here
    }
  }, 0);
}

/** A button that opens the system's date picker next to itself; the date input stays invisible under it. */
function DatePick({
  value,
  onChange,
  label,
  className,
  children,
}: DatePickProps) {
  const input = useRef<HTMLInputElement>(null);
  const open = () => {
    try {
      input.current?.showPicker();
    } catch {
      input.current?.focus(); // no showPicker here: the field itself takes the date
    }
  };
  return (
    <span className="date-pick">
      <Tooltip label={label}>
        <button
          type="button"
          className={className}
          aria-label={label}
          onClick={open}
        >
          {children}
        </button>
      </Tooltip>
      <input
        ref={input}
        type="date"
        className="date-pick__input"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </span>
  );
}

export default DatePick;
