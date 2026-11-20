// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from "react";
import type { ItemKind } from "../types";

interface Shortcuts {
  mode: "new" | "detail" | "edit" | "trash";
  hasSelection: boolean;
  onNew: (kind: ItemKind) => void;
  onEdit: () => void;
  onDone: () => void;
  onOpenSearch: () => void;
  // Ctrl+F: find in the open note (the parent falls back to the search palette when none is open)
  onFind: () => void;
  onOpenSettings: () => void;
  // Ctrl+Shift+T: between the Notes and the Tasks tab
  onSwitchTab: () => void;
}

export function useKeyboardShortcuts({
  mode,
  hasSelection,
  onNew,
  onEdit,
  onDone,
  onOpenSearch,
  onFind,
  onOpenSettings,
  onSwitchTab,
}: Shortcuts): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // A dialog (search, update) owns the keyboard while it is open
      if (document.querySelector('[aria-modal="true"]')) return;

      // Also while editing: starting a new item saves the open edit first.
      // Shift is held, so the key arrives upper-case. Ctrl+N note, Ctrl+Shift+N code.
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNew(e.shiftKey ? "code" : "note");
      }

      if (e.key === "k") {
        e.preventDefault();
        onOpenSearch();
      }

      if (e.key === "f") {
        e.preventDefault();
        onFind();
      }

      if (e.key === ",") {
        e.preventDefault();
        onOpenSettings();
      }

      if (e.key.toLowerCase() === "t" && e.shiftKey && !e.altKey) {
        e.preventDefault();
        onSwitchTab();
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
  }, [
    mode,
    hasSelection,
    onNew,
    onEdit,
    onDone,
    onOpenSearch,
    onFind,
    onOpenSettings,
    onSwitchTab,
  ]);
}
