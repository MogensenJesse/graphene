// src/hooks/useBack.ts
import { createContext, useContext, useEffect } from "react";
import { pushBack } from "../lib/backStack";
import { useLatest } from "./useLatest";

/**
 * True for the part of the page that something else covers: the screens of a phone while its list is showing. What is open there gets
 * no Back step, so Back never runs one the user cannot see (the editor opened from the list stays mounted under it).
 */
export const BackCovered = createContext(false);

/**
 * What the Android Back key does while this is open: it closes it, before anything under it. Registered once per `active`, so a
 * re-render does not move it above something that opened later.
 */
export function useBack(onBack: () => void, active = true): void {
  const latest = useLatest(onBack);
  const covered = useContext(BackCovered);
  useEffect(() => {
    if (!active || covered) return;
    return pushBack(() => latest.current());
  }, [active, covered, latest]);
}
