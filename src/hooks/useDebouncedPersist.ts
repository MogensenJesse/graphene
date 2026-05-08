// src/hooks/useDebouncedPersist.ts
import { useEffect, useRef } from "react";

export function useDebouncedPersist<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  delayMs = 300,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<T>(data);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  useEffect(() => {
    latestDataRef.current = data;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      saveFnRef.current(latestDataRef.current).catch(console.error);
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, delayMs]);

  // Flush any pending save immediately on unmount so the last edit is not lost
  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        saveFnRef.current(latestDataRef.current).catch(console.error);
      }
    },
    [],
  );
}
