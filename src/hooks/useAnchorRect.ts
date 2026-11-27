// src/hooks/useAnchorRect.ts
import { useEffect, useState } from "react";
import { useLatest } from "./useLatest";

/**
 * Where the box a popover hangs from is now. It starts as `initial` and is measured again when the window is resized, which is what the
 * on-screen keyboard of a phone does: the popover then places itself again instead of closing. `onGone` is called when the box has left
 * the page. With no `element` there is nothing to follow.
 */
export function useAnchorRect(
  initial: DOMRect,
  element: Element | null | undefined,
  onGone: () => void,
): DOMRect {
  const [rect, setRect] = useState(initial);
  const gone = useLatest(onGone);

  useEffect(() => {
    if (!element) return;
    const measure = () => {
      if (!element.isConnected) gone.current();
      // A new object each time, so the popover places itself again even when only the room around the box changed
      else setRect(element.getBoundingClientRect());
    };
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [element, gone]);

  return rect;
}
