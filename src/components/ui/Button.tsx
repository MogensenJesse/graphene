// src/components/ui/Button.tsx
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant =
  | "default"
  | "primary"
  | "solid"
  | "danger"
  | "quiet"
  | "link";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: the action a dialog asks for; solid: the main action where blue would shout; link: text only */
  variant?: ButtonVariant;
  /** sm is the 24px button of a header, a bar or a toast; lg is the first-run call to action */
  size?: "sm" | "md" | "lg";
  /** A square with just an icon (small size only): give it an aria-label */
  iconOnly?: boolean;
}

/** The app's one button (see _Button.scss). Anything else a <button> takes goes straight through, so a Tooltip can wrap it. */
function Button({
  variant = "default",
  size = "md",
  iconOnly = false,
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size}${iconOnly ? " btn--icon" : ""}${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
}

export default Button;
