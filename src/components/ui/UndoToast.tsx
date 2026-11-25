// src/components/ui/UndoToast.tsx
import { type ReactNode, useEffect, useState } from "react";
import { useLatest } from "../../hooks/useLatest";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { modalOpen } from "../../lib/focusTrap";
import { isTextField } from "../../lib/textMenu";
import Button from "./Button";

const SHOW_MS = 6000;
// How long it takes to fade out: the toast-out animation in _Toast.scss
const LEAVE_MS = 150;

// The toasts on screen, oldest first: a note and a task can both be waiting, and Ctrl+Z undoes only the newest
const live: object[] = [];

// A text field keeps Ctrl+Z for its own undo, unless it has nothing to undo: an empty field, or the draft a delete has just opened
// (NoteEditor marks it `data-pristine` until something is typed), so Ctrl+Z straight after Del still brings the note back
const keepsKey = (target: EventTarget | null) =>
  isTextField(target) &&
  target.value !== "" &&
  target.dataset.pristine !== "true";

interface UndoToastProps {
  message: ReactNode;
  onUndo: () => void;
  onClose: () => void;
}

/**
 * A message with an Undo button, at the bottom of the main panel ("Moved "x" to trash"). It fades out and goes by
 * itself after a few seconds, unless the pointer or the focus is on it. Ctrl+Z is Undo, where it is not already a
 * text field's own undo.
 */
function UndoToast({ message, onUndo, onClose }: UndoToastProps) {
  const close = useLatest(onClose);
  const undo = useLatest(onUndo);
  const [leaving, setLeaving] = useState(false);
  const [held, setHeld] = useState(false);
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    if (held) return;
    const t = setTimeout(() => setLeaving(true), SHOW_MS);
    return () => clearTimeout(t);
  }, [held]);

  useEffect(() => {
    const me = {};
    live.push(me);
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "z" || live[live.length - 1] !== me) return;
      if (keepsKey(e.target) || modalOpen()) return;
      if (document.querySelector('[role="menu"]')) return;
      e.preventDefault();
      undo.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      live.splice(live.indexOf(me), 1);
    };
  }, [undo]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => close.current(), still ? 0 : LEAVE_MS);
    return () => clearTimeout(t);
  }, [leaving, still, close]);

  return (
    <div
      className={`toast${leaving ? " toast--leaving" : ""}`}
      role="status"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span className="toast__text">{message}</span>
      <Button variant="primary" size="sm" onClick={onUndo}>
        Undo
      </Button>
    </div>
  );
}

export default UndoToast;
