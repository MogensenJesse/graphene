// src/components/ui/menuEntries.tsx
// Entries that more than one menu has, so each is written once.
import type { ReactNode } from "react";
import { IS_ANDROID } from "../../lib/platform";
import { flattenFolders } from "../../lib/utils";
import type { Folder } from "../../types";
import type { MenuEntry } from "./ContextMenu";
import {
  ClipboardIcon,
  ExternalLinkIcon,
  FolderIcon,
  NoFolderIcon,
} from "./Icon";

interface FolderChoice {
  folders: Folder[];
  /** The order of the folders among their siblings */
  compare: (a: Folder, b: Folder) => number;
  /** What choosing no folder is called: "No folder" for a note, "Top level" for a folder */
  rootLabel: string;
  /** Where the thing is now: that row is checked and cannot be chosen */
  currentId: string | null;
  /** Folders left out (a folder cannot go into itself or into what is inside it) */
  skip?: (folder: Folder) => boolean;
  /** Every row off (the note being edited cannot be moved) */
  disabled?: boolean;
  onPick: (folderId: string | null) => void;
}

/** The rows of a "Move to" menu: no folder, then every folder as a tree, indented by depth. */
export function folderChoiceEntries({
  folders,
  compare,
  rootLabel,
  currentId,
  skip,
  disabled = false,
  onPick,
}: FolderChoice): MenuEntry[] {
  const to = (
    id: string | null,
    label: string,
    icon: ReactNode,
    indent = 0,
  ): MenuEntry => ({
    label,
    icon,
    indent,
    checked: currentId === id,
    disabled: currentId === id || disabled,
    onSelect: () => onPick(id),
  });
  return [
    to(null, rootLabel, <NoFolderIcon size={14} />),
    ...flattenFolders(folders, compare)
      .filter(({ folder }) => !skip?.(folder))
      .map(({ folder, depth }) =>
        to(folder.id, folder.name, <FolderIcon size={14} />, depth),
      ),
  ];
}

/** Show in Explorer and Copy path. Android keeps its notes in the app's own storage, which no file manager shows: no entries there. */
export function revealEntries(
  onReveal: () => void,
  onCopyPath: () => void,
  disabled = false,
): MenuEntry[] {
  if (IS_ANDROID) return [];
  return [
    {
      label: "Show in Explorer",
      icon: <ExternalLinkIcon size={14} />,
      disabled,
      onSelect: onReveal,
    },
    {
      label: "Copy path",
      icon: <ClipboardIcon size={14} />,
      disabled,
      onSelect: onCopyPath,
    },
  ];
}
