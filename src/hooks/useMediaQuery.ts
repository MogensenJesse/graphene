// src/hooks/useMediaQuery.ts
import { useCallback, useMemo, useSyncExternalStore } from "react";

/** Whether the window matches a media query, kept up to date as it is resized. */
export function useMediaQuery(query: string): boolean {
  // One list per query, and a `subscribe` that stays the same between renders: a new one each render makes React unsubscribe and
  // subscribe again every time
  const list = useMemo(() => window.matchMedia(query), [query]);
  const subscribe = useCallback(
    (notify: () => void) => {
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [list],
  );
  return useSyncExternalStore(subscribe, () => list.matches);
}
