// src/hooks/useClickOutside.ts
import { useEffect } from "react";

/**
 * Calls `onOutside` when a mousedown event occurs outside the element
 * referenced by `ref`. The listener is only attached when `active` is true.
 */
export function useClickOutside(
  ref: React.RefObject<Element | null>,
  active: boolean,
  onOutside: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [ref, active, onOutside]);
}
