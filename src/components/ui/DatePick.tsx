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
