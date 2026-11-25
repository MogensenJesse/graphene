// src/hooks/useDeleteConfirm.ts
import { type RefObject, useEffect, useState } from "react";
import { useEscape } from "./useEscape";
import { useLatest } from "./useLatest";

/**
 * Two-step delete of the thing `key` names (an item id, a folder id): the first request arms the
 * confirmation, the second runs `onConfirm`. Escape disarms it, and so does `key` changing. The Del key
 * does the same unless `keyEnabled` is false, and only while the focus is inside `scope` when one is given
 * (a selected folder owns Del while the tree has the focus, so Del in a note still trashes the note). A held
 * key (repeat), a text field, an open dialog and an open menu never count.
 */
export function useDeleteConfirm(
  key: string,
  onConfirm: () => void,
  keyEnabled = true,
  scope?: RefObject<HTMLElement | null>,
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
      // A held key repeats: it must never arm and then confirm on its own
      if (e.key !== "Delete" || e.repeat) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (document.querySelector('[aria-modal="true"], [role="menu"]')) return;
      if (
        scope &&
        !(e.target instanceof Node && scope.current?.contains(e.target))
      )
        return;
      // The press is ours: the note's own Del handler, on the document, must not trash the open note too
      e.stopPropagation();
      if (confirming) {
        setArmed(null);
        confirm.current();
      } else setArmed(key);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [keyEnabled, confirming, key, confirm, scope]);

  return {
    confirming,
    arm: (forKey = key) => setArmed(forKey),
    requestDelete,
    cancelConfirm,
  };
}
