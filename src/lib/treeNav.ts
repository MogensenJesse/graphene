// src/lib/treeNav.ts
// The keyboard side of the sidebar's tree (the WAI-ARIA tree pattern): which rows are on screen, in the order they are drawn, and
// where each key goes from the row the tree is on. Pure, so the sidebar only has to do what a step says.
import type { Folder } from "../types";

export interface TreeRow {
  kind: "folder" | "item";
  id: string;
  /** The folder it sits in; null at the top level */
  parent: string | null;
  /** A folder with something inside it (a subfolder or a note): the only kind a key can open or close */
  expandable: boolean;
  expanded: boolean;
}

export type TreeKey = Pick<TreeRow, "kind" | "id">;

export type TreeMove = "down" | "up" | "home" | "end" | "right" | "left";

/** What a key does: land on a row, or open or close a folder. `null` is a key with nothing to do here. */
export type TreeStep =
  | { do: "focus"; row: TreeKey }
  | { do: "expand"; id: string }
  | { do: "collapse"; id: string };

/**
 * The rows that are on screen, top to bottom: each folder (in `compare` order) with, when it is open, its subfolders and then
 * its notes, and last the notes that are in no folder. `byFolder` is each folder's notes in the order shown (null: no folder).
 */
export function visibleRows(
  folders: readonly Folder[],
  byFolder: ReadonlyMap<string | null, readonly { id: string }[]>,
  compare: (a: Folder, b: Folder) => number,
  isCollapsed: (folderId: string) => boolean,
): TreeRow[] {
  const subfolders = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const siblings = subfolders.get(folder.parentId);
    if (siblings) siblings.push(folder);
    else subfolders.set(folder.parentId, [folder]);
  }
  const rows: TreeRow[] = [];
  const addNotes = (parent: string | null) => {
    for (const note of byFolder.get(parent) ?? [])
      rows.push({
        kind: "item",
        id: note.id,
        parent,
        expandable: false,
        expanded: false,
      });
  };
  const walk = (parent: string | null) => {
    for (const folder of (subfolders.get(parent) ?? []).sort(compare)) {
      const expandable =
        subfolders.has(folder.id) || (byFolder.get(folder.id)?.length ?? 0) > 0;
      const expanded = expandable && !isCollapsed(folder.id);
      rows.push({
        kind: "folder",
        id: folder.id,
        parent,
        expandable,
        expanded,
      });
      if (expanded) {
        walk(folder.id);
        addNotes(folder.id);
      }
    }
  };
  walk(null);
  addNotes(null);
  return rows;
}

/**
 * Where `move` goes from the row `from` (null: the tree is on no row, or on one that is not on screen). Down and Up step one row
 * (from no row both land on the first); Home and End the first and last. Right opens a closed folder, and from an open one goes to
 * its first row inside; Left closes an open folder, and from a note or a closed folder goes to the folder it sits in.
 */
export function treeStep(
  rows: readonly TreeRow[],
  from: TreeKey | null,
  move: TreeMove,
): TreeStep | null {
  if (rows.length === 0) return null;
  const at = from
    ? rows.findIndex((r) => r.kind === from.kind && r.id === from.id)
    : -1;
  const here = rows[at];
  const land = (row: TreeRow | undefined): TreeStep | null =>
    row && row !== here ? { do: "focus", row } : null;

  switch (move) {
    case "home":
      return land(rows[0]);
    case "end":
      return land(rows[rows.length - 1]);
    case "down":
      return land(rows[at + 1]);
    case "up":
      return land(rows[at < 0 ? 0 : at - 1]);
    case "right":
      if (here?.kind !== "folder" || !here.expandable) return null;
      return here.expanded ? land(rows[at + 1]) : { do: "expand", id: here.id };
    case "left": {
      if (!here) return null;
      if (here.expanded) return { do: "collapse", id: here.id };
      return here.parent === null
        ? null
        : land(rows.find((r) => r.kind === "folder" && r.id === here.parent));
    }
  }
}

/** The DOM id of a row's `treeitem`, for the tree's `aria-activedescendant` (a folder id has slashes and may have spaces). */
export const treeItemId = (key: TreeKey): string =>
  `tree-${key.kind === "folder" ? "f" : "n"}-${encodeURIComponent(key.id)}`;

/** How deep a folder sits (the top level is 1): its id is its path. A note is one deeper than its folder. */
export const folderLevel = (folderId: string): number =>
  folderId.split("/").length;
