// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from "react";

export function useKeyboardShortcuts(
  mode: "new" | "detail" | "edit",
  onNew: () => void,
  onEdit: () => void,
  hasSelection: boolean,
): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      if (e.key === "n" && mode !== "new" && mode !== "edit") {
        e.preventDefault();
        onNew();
      }

      if (e.key === "e" && mode === "detail" && hasSelection) {
        e.preventDefault();
        onEdit();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode, hasSelection, onNew, onEdit]);
}
