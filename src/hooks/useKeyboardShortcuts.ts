// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from "react";

interface Shortcuts {
  mode: "new" | "detail" | "edit";
  hasSelection: boolean;
  onNew: () => void;
  onEdit: () => void;
  onDone: () => void;
  onFocusSearch: () => void;
}

export function useKeyboardShortcuts({
  mode,
  hasSelection,
  onNew,
  onEdit,
  onDone,
  onFocusSearch,
}: Shortcuts): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      // Also while editing: starting a new item saves the open edit first
      if (e.key === "n") {
        e.preventDefault();
        onNew();
      }

      if (e.key === "k" || e.key === "f") {
        e.preventDefault();
        onFocusSearch();
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
  }, [mode, hasSelection, onNew, onEdit, onDone, onFocusSearch]);
}
