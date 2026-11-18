// src/hooks/useEscape.ts
import { useEffect } from "react";
import { useLatest } from "./useLatest";

interface EscapeOptions {
  /** Listen only while true (a popup that is open, a confirmation that is armed). */
  active?: boolean;
  /**
   * Listen in the capture phase and swallow the key, so an open editor's own Escape handler does not
   * also leave the editor.
   */
  capture?: boolean;
  /** An extra condition; the key is ignored (and not swallowed) when it returns false. */
  when?: () => boolean;
}

/** Runs `onEscape` when Escape is pressed anywhere in the window. */
export function useEscape(
  onEscape: () => void,
  { active = true, capture = false, when }: EscapeOptions = {},
): void {
  const handler = useLatest(onEscape);
  const condition = useLatest(when);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || condition.current?.() === false) return;
      if (capture) e.stopPropagation();
      handler.current();
    };
    document.addEventListener("keydown", onKeyDown, capture);
    return () => document.removeEventListener("keydown", onKeyDown, capture);
  }, [active, capture, handler, condition]);
}
