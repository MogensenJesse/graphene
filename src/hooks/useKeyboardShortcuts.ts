// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from "react";

interface Shortcuts {
  mode: "new" | "detail" | "edit" | "trash";
  hasSelection: boolean;
  onNew: (kind: "note" | "code") => void;
  onEdit: () => void;
  onDone: () => void;
  onOpenSearch: () => void;
}

export function useKeyboardShortcuts({
  mode,
  hasSelection,
  onNew,
  onEdit,
  onDone,
  onOpenSearch,
}: Shortcuts): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // A dialog (search, update) owns the keyboard while it is open
      if (document.querySelector('[aria-modal="true"]')) return;

      // Also while editing: starting a new item saves the open edit first.
      // Shift is held, so the key arrives upper-case.
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNew(e.shiftKey ? "code" : "note");
      }

      if (e.key === "k" || e.key === "f") {
        e.preventDefault();
        onOpenSearch();
      }

      // Ctrl+E toggles between reading and editing
      if (e.key === "e") {
        if (mode === "detail" && hasSelection) {
          e.preventDefault();
          onEdit();
        } else if (mode === "edit") {
          e.preventDefault();
          onDone();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode, hasSelection, onNew, onEdit, onDone, onOpenSearch]);
}
