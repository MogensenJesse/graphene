// src/components/ui/Checkbox.tsx
import type { InputHTMLAttributes } from "react";

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** The round one of a task; square is for a checkbox in a note and in Settings */
  round?: boolean;
}

/** The app's one checkbox, drawn in CSS (see _Checkbox.scss). It is a real input, so the label and the keyboard work as usual. */
function Checkbox({ round = false, className, ...rest }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={`checkbox${round ? " checkbox--round" : ""}${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
}

export default Checkbox;
