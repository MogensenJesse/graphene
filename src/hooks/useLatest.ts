// src/hooks/useLatest.ts
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

/** A ref that holds the value of the latest render, so a long-lived listener can call the newest callback without re-subscribing. */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * A function whose identity never changes and that always runs the newest `fn`: a prop for a `memo` child that does not break its
 * memo on every render, without a list of dependencies. It follows the render in the commit itself (a layout effect), so no event
 * can reach an older one; only a layout effect of a child, which runs first in that commit, could.
 */
export function useStable<A extends unknown[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  const latest = useRef(fn);
  useLayoutEffect(() => {
    latest.current = fn;
  });
  return useCallback((...args: A) => latest.current(...args), []);
}
