// src/hooks/useMediaQuery.ts
import { useSyncExternalStore } from "react";

/** Whether the window matches a media query, kept up to date as it is resized. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
  );
}
