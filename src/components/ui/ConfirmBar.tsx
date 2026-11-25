// src/components/ui/ConfirmBar.tsx
import type { ReactNode } from "react";
import Button from "./Button";

interface ConfirmBarProps {
  question: ReactNode;
  /** The button that goes ahead (Delete by default) */
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A question that waits for a yes, in the page under what it is about; Cancel is the way out (the caller may also bind Escape). */
function ConfirmBar({
  question,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmBarProps) {
  return (
    <div className="confirm-bar" role="alert">
      <span>{question}</span>
      <div className="confirm-bar__actions">
        <Button variant="danger" size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default ConfirmBar;
