// src/components/Modal.tsx
import { type ReactNode, useEffect } from "react";

interface ModalProps {
  /** Accessible name of the dialog */
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

// Backdrop + centred panel shared by the search palette and the update dialog
function Modal({ label, onClose, className, children }: ModalProps) {
  // Capture-phase Escape closes the dialog and is swallowed, so an open editor's own Escape
  // handler does not also leave the editor (same trick as FolderPicker)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  // Hand focus back to whatever had it before the dialog opened
  useEffect(() => {
    const previous = document.activeElement;
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking the backdrop is a mouse shortcut for Escape, which the keydown handler above already covers
    <div
      className="modal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal__panel${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

export default Modal;
