// src/components/ui/UndoToast.tsx
import { type ReactNode, useEffect } from "react";
import { useLatest } from "../../hooks/useLatest";

const SHOW_MS = 6000;

interface UndoToastProps {
  message: ReactNode;
  onUndo: () => void;
  onClose: () => void;
}

/** A message with an Undo button, at the bottom of the main panel ("Moved "x" to trash"). It goes by itself after a few seconds. */
function UndoToast({ message, onUndo, onClose }: UndoToastProps) {
  const close = useLatest(onClose);
  useEffect(() => {
    const t = setTimeout(() => close.current(), SHOW_MS);
    return () => clearTimeout(t);
  }, [close]);

  return (
    <div className="toast" role="status">
      <span className="toast__text">{message}</span>
      <button type="button" className="toast__btn" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}

export default UndoToast;
