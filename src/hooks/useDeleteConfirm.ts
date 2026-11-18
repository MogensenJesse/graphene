// src/hooks/useDeleteConfirm.ts
import { useEffect, useState } from "react";
import { useEscape } from "./useEscape";
import { useLatest } from "./useLatest";

/**
 * Two-step delete of the thing `key` names (an item id, a folder id): the first request arms the
 * confirmation, the second runs `onConfirm`. Escape disarms it, and so does `key` changing. The Del key
 * does the same unless `keyEnabled` is false (a selected folder owns Del while a note is open).
 */
export function useDeleteConfirm(
  key: string,
  onConfirm: () => void,
  keyEnabled = true,
): {
  confirming: boolean;
  /** Ask for the confirmation of `forKey` (default `key`) without confirming an armed one. */
  arm: (forKey?: string) => void;
  /** Arms the confirmation; when it is armed already, runs `onConfirm`. */
  requestDelete: () => void;
  cancelConfirm: () => void;
} {
  const [armed, setArmed] = useState<string | null>(null);
  const confirming = armed === key;
  const confirm = useLatest(onConfirm);

  const requestDelete = () => {
    if (confirming) {
      setArmed(null);
      confirm.current();
    } else setArmed(key);
  };
  const cancelConfirm = () => setArmed(null);

  useEscape(cancelConfirm, { active: confirming });

  useEffect(() => {
    if (!keyEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (confirming) {
        setArmed(null);
        confirm.current();
      } else setArmed(key);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [keyEnabled, confirming, key, confirm]);

  return {
    confirming,
    arm: (forKey = key) => setArmed(forKey),
    requestDelete,
    cancelConfirm,
  };
}
