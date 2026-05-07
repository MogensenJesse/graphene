// src/hooks/useClipboard.ts
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useCallback, useEffect, useRef, useState } from "react";

const RESET_DELAY_MS = 1400;

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the reset timer on unmount to avoid a setState on an unmounted component
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(async (text: string): Promise<void> => {
    try {
      await writeText(text);
      setCopied(true);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setCopied(false);
      }, RESET_DELAY_MS);
    } catch (err) {
      console.error("[clipboard] copy failed:", err);
    }
  }, []);

  return { copy, copied };
}
