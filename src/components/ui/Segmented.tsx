// src/components/ui/Segmented.tsx
import type { ReactNode } from "react";

interface SegmentedProps<T extends string> {
  /** Accessible name of the group */
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
}

// A row of buttons of which one is pressed: the Notes | Tasks tabs, the theme and size pickers in Settings
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <fieldset
      className={`segments${className ? ` ${className}` : ""}`}
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segments__item${option.value === value ? " segments__item--active" : ""}`}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

export default Segmented;
