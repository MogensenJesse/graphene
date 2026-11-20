// src/components/ui/Modal.tsx
import { type ReactNode, useEffect } from "react";
import { useEscape } from "../../hooks/useEscape";
import { isTextField } from "../../lib/textMenu";

interface ModalProps {
  /** Accessible name of the dialog */
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

// Backdrop + centred panel shared by the search palette and the update dialog
function Modal({ label, onClose, className, children }: ModalProps) {
  // A right-click menu over the dialog takes the first Escape; the next one closes the dialog. So does a field
  // that has its own use for it: wrap it in [data-owns-escape] (a rename that Escape cancels)
  useEscape(onClose, {
    capture: true,
    when: () =>
      !document.querySelector(".context-menu") &&
      !document.activeElement?.closest("[data-owns-escape]"),
  });

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
        // Primary button only: a right-click on the backdrop must not close the dialog
        if (e.target === e.currentTarget && e.button === 0) onClose();
      }}
      // The app's right-click menu is for the window behind; only text fields keep theirs
      onContextMenu={(e) => {
        if (isTextField(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
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
