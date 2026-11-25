// src/components/ui/Modal.tsx
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useEscape } from "../../hooks/useEscape";
import { lockApp, tabStops, tabTarget } from "../../lib/focusTrap";
import { isTextField } from "../../lib/textMenu";

interface ModalProps {
  /** Accessible name of the dialog */
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

// Backdrop + centred panel shared by the search palette, Settings and the update dialog. It keeps the keyboard to
// itself: the page behind is inert, the focus starts inside and Tab wraps at the ends, and closing hands the focus
// back to whatever opened it. It renders into the body, so the search palette (opened from inside `.app`) is not
// made inert with the page.
function Modal({ label, onClose, className, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Read while rendering, before anything in the dialog takes the focus (an autoFocus field would have it by an effect)
  const opener = useRef(document.activeElement);

  // A right-click menu over the dialog takes the first Escape; the next one closes the dialog. So does a field
  // that has its own use for it: wrap it in [data-owns-escape] (a rename that Escape cancels)
  useEscape(onClose, {
    capture: true,
    when: () =>
      !document.querySelector(".context-menu") &&
      !document.activeElement?.closest("[data-owns-escape]"),
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const release = lockApp();

    // A field that took the focus itself while mounting keeps it. Otherwise the control the dialog marks with
    // data-autofocus (the safe choice, when the first control is not), else the first one, else the frame
    if (!panel.contains(document.activeElement))
      (
        panel.querySelector<HTMLElement>("[data-autofocus]:not(:disabled)") ??
        tabStops(panel)[0] ??
        panel
      ).focus();

    // Tab wraps at the ends. A menu or the error toast on top of the dialog has the keys while the focus is in it
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.defaultPrevented) return;
      const active = document.activeElement;
      if (active !== document.body && !panel.contains(active)) return;
      const stops = tabStops(panel);
      const to = tabTarget(
        stops.length,
        active instanceof HTMLElement ? stops.indexOf(active) : -1,
        e.shiftKey,
      );
      if (to === null) return;
      e.preventDefault();
      (to === "panel" ? panel : stops[to]).focus();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      release(); // first: an inert element cannot take the focus back
      const back = opener.current;
      if (back instanceof HTMLElement && back.isConnected) back.focus();
    };
  }, []);

  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking the backdrop is a mouse shortcut for Escape, which the keydown handler above already covers
    <div
      className="modal"
      role="presentation"
      onMouseDown={(e) => {
        // Primary button only: a right-click on the backdrop must not close the dialog
        if (e.target === e.currentTarget && e.button === 0) {
          e.preventDefault(); // else the click's own focus step lands on the body after the opener got the focus back
          onClose();
        }
      }}
      // The app's right-click menu is for the window behind; only text fields keep theirs
      onContextMenu={(e) => {
        if (isTextField(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        ref={panelRef}
        className={`modal__panel${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // A frame that can hold the focus: a click on a dead spot stays in the dialog, so Tab still wraps
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
