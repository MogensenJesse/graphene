// src/components/ui/IconButton.tsx
import type { ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** What it does: it has no text of its own */
  "aria-label": string;
  /** 22px for the actions on a row, 24px for a bar (default), 32px for the sidebar footer */
  size?: "sm" | "md" | "lg";
  /** tool: a toggle of a toolbar, 26px with a hairline (aria-pressed lights it); danger: goes red when pointed at */
  variant?: "default" | "tool" | "danger";
}

/** A button that is just an icon, with no border (see _Button.scss). Wrap it in a Tooltip when its name needs showing. */
function IconButton({
  size = "md",
  variant = "default",
  type = "button",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`icon-btn icon-btn--${size}${variant === "default" ? "" : ` icon-btn--${variant}`}${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
}

export default IconButton;
