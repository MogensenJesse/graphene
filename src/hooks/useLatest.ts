// src/hooks/useLatest.ts
import { type RefObject, useEffect, useRef } from "react";

/** A ref that holds the value of the latest render, so a long-lived listener can call the newest callback without re-subscribing. */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
