// src/hooks/useDebouncedValue.ts
import { useEffect, useState } from "react";

/** `value` as it was `ms` after it last changed, for work that may lag behind typing (the word count of a big note). */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setShown(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return shown;
}
