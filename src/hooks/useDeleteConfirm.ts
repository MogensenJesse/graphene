// src/hooks/useDeleteConfirm.ts
import { useEffect, useRef, useState } from "react";

/**
 * Two-step delete: the first request arms the confirmation, the second runs `onConfirm`.
 * The Del key does the same unless `keyEnabled` is false (e.g. a selected folder owns Del).
 */
export function useDeleteConfirm(
  itemId: string,
  onConfirm: () => void,
  keyEnabled = true,
): {
  confirming: boolean;
  requestDelete: () => void;
  cancelConfirm: () => void;
} {
  const [confirming, setConfirming] = useState(false);

  // Latest callback without re-subscribing the key listener on every render
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: itemId is an intentional trigger — reset confirming whenever the viewed item changes
  useEffect(() => {
    setConfirming(false);
  }, [itemId]);

  useEffect(() => {
    if (!confirming) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [confirming]);

  useEffect(() => {
    if (!keyEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (confirming) onConfirmRef.current();
      else setConfirming(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [keyEnabled, confirming]);

  return {
    confirming,
    requestDelete: () => {
      if (confirming) onConfirmRef.current();
      else setConfirming(true);
    },
    cancelConfirm: () => setConfirming(false),
  };
}
