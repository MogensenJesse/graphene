// src/components/ui/newKinds.tsx
import type { ItemKind } from "../../types";
import type { MenuEntry } from "./ContextMenu";
import { CodeIcon, NoteIcon } from "./Icon";

/** The two things "new" can start: what each is called, drawn with and started by. */
export const NEW_KINDS = [
  { kind: "note", label: "note", Icon: NoteIcon, shortcut: "Ctrl+N" },
  { kind: "code", label: "code", Icon: CodeIcon, shortcut: "Ctrl+Shift+N" },
] as const;

/**
 * The "New note / code" entries of a context menu; `suffix` is for "here" in a folder's menu. `showKeys` shows
 * Ctrl+N and Ctrl+Shift+N: only for entries that start the note where the shortcut does (wherever the selection is),
 * so not a "here" entry and not one that names a folder.
 */
export function newItemEntries(
  onNew: (kind: ItemKind) => void,
  suffix = "",
  showKeys = suffix === "",
): MenuEntry[] {
  return NEW_KINDS.map(({ kind, label, Icon, shortcut }) => ({
    label: `New ${label}${suffix}`,
    icon: <Icon size={14} />,
    keys: showKeys ? shortcut : undefined,
    onSelect: () => onNew(kind),
  }));
}
