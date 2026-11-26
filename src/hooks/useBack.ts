// src/hooks/useBack.ts
import { useEffect } from "react";
import { pushBack } from "../lib/backStack";
import { useLatest } from "./useLatest";

/**
 * What the Android Back key does while this is open: it closes it, before anything under it. Registered once per `active`, so a
 * re-render does not move it above something that opened later.
 */
export function useBack(onBack: () => void, active = true): void {
  const latest = useLatest(onBack);
  useEffect(() => {
    if (!active) return;
    return pushBack(() => latest.current());
  }, [active, latest]);
}
