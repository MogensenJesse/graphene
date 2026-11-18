// src/components/ui/UndoToast.tsx
import { useEffect } from "react";
import { useLatest } from "../../hooks/useLatest";

const SHOW_MS = 6000;

interface UndoToastProps {
  title: string;
  onUndo: () => void;
  onClose: () => void;
}

/** "Moved "x" to trash" with an Undo button, at the bottom of the main panel. It goes by itself after a few seconds. */
function UndoToast({ title, onUndo, onClose }: UndoToastProps) {
  const close = useLatest(onClose);
  useEffect(() => {
    const t = setTimeout(() => close.current(), SHOW_MS);
    return () => clearTimeout(t);
  }, [close]);

  return (
    <div className="toast" role="status">
      <span className="toast__text">
        Moved &ldquo;<span className="toast__title">{title || "Untitled"}</span>
        &rdquo; to trash
      </span>
      <button type="button" className="toast__btn" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}

export default UndoToast;
