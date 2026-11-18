// src/hooks/useListRef.ts
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from "react";

/**
 * A list whose ref is updated at once by the setter: a read between renders sees the latest list, and
 * updaters run here, once, instead of inside React (where StrictMode runs them twice, so they must stay pure).
 */
export function useListRef<T>(): [
  T[],
  Dispatch<SetStateAction<T[]>>,
  RefObject<T[]>,
] {
  const [list, setState] = useState<T[]>([]);
  const ref = useRef(list);
  const set = useCallback((update: SetStateAction<T[]>) => {
    const next = typeof update === "function" ? update(ref.current) : update;
    ref.current = next;
    setState(next);
  }, []);
  return [list, set, ref];
}
