// src/components/ui/UndoToast.tsx
import { type ReactNode, useEffect, useState } from "react";
import { useLatest } from "../../hooks/useLatest";
import { useMediaQuery } from "../../hooks/useMediaQuery";

const SHOW_MS = 6000;
// How long it takes to fade out: the toast-out animation in _Toast.scss
const LEAVE_MS = 150;

interface UndoToastProps {
  message: ReactNode;
  onUndo: () => void;
  onClose: () => void;
}

/** A message with an Undo button, at the bottom of the main panel ("Moved "x" to trash"). It fades out and goes by itself after a few seconds. */
function UndoToast({ message, onUndo, onClose }: UndoToastProps) {
  const close = useLatest(onClose);
  const [leaving, setLeaving] = useState(false);
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), SHOW_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => close.current(), still ? 0 : LEAVE_MS);
    return () => clearTimeout(t);
  }, [leaving, still, close]);

  return (
    <div className={`toast${leaving ? " toast--leaving" : ""}`} role="status">
      <span className="toast__text">{message}</span>
      <button type="button" className="toast__btn" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}

export default UndoToast;
