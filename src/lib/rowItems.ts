// src/lib/rowItems.ts
// What the sidebar needs of the notes, kept the same object for as long as it is the same to look at.
// A batch of note texts replaces every note it fills, though a row shows none of a text; without this each batch would render every
// row again (8 long frames at 20k notes, 10 at 50k). With it the batch changes nothing the sidebar is given.
import type { Folder, Item } from "../types";
import { itemKind } from "./utils";

/** Whether two copies of a note draw the same row and sort the same: title, folder, rank, edited date and kind. Its text does not count. */
export const sameRow = (a: Item, b: Item): boolean =>
  a.title === b.title &&
  a.folderId === b.folderId &&
  a.order === b.order &&
  a.updatedAt === b.updatedAt &&
  itemKind(a) === itemKind(b);

/**
 * `next`, as the sidebar wants it: the very same array as `prev` when no note differs in what a row shows, and for each note that
 * does not, the very same object it had. The ids usually come in the same order (a batch of texts), which skips the lookup table.
 */
export function rowItems(prev: Item[], next: Item[]): Item[] {
  if (prev === next) return prev;
  const aligned =
    prev.length === next.length &&
    next.every((item, at) => item.id === prev[at].id);
  const before = aligned ? null : new Map(prev.map((item) => [item.id, item]));
  let same = aligned;
  const rows = next.map((item, at) => {
    const old = before ? before.get(item.id) : prev[at];
    const row = old && sameRow(old, item) ? old : item;
    if (row !== prev[at]) same = false;
    return row;
  });
  return same ? prev : rows;
}

export type Compare = (a: Item, b: Item) => number;

/** The notes in the order `compare` gives, with what the next call needs to skip the sort. */
export interface SortedRows {
  rows: Item[];
  compare: Compare;
  sorted: Item[];
}

/**
 * `rows` sorted by `compare`. A save changes one note's edited date, and sorting every note again for it (a big vault: tens of
 * milliseconds, every few seconds while typing) is a waste when the order cannot change: when the notes come in the same places
 * as in `prev` and each one that differs compares equal to its old self, the old order stands with those notes swapped in
 * (nothing is compared but the ones that differ), and with none different the very same array comes back.
 */
export function sortRows(
  prev: SortedRows | null,
  rows: Item[],
  compare: Compare,
): SortedRows {
  if (prev && prev.compare === compare && prev.rows.length === rows.length) {
    const swapped = new Map<Item, Item>();
    let at = 0;
    for (; at < rows.length; at++) {
      const old = prev.rows[at];
      const row = rows[at];
      if (row === old) continue;
      if (row.id !== old.id || compare(old, row) !== 0) break;
      swapped.set(old, row);
    }
    if (at === rows.length)
      return {
        rows,
        compare,
        sorted: swapped.size
          ? prev.sorted.map((row) => swapped.get(row) ?? row)
          : prev.sorted,
      };
  }
  return { rows, compare, sorted: rows.slice().sort(compare) };
}

/** The notes of each folder (the key is `null` for those outside any), in the order given. */
export type NotesByFolder = ReadonlyMap<string | null, Item[]>;

/**
 * The notes grouped by folder. A folder whose notes are the same objects in the same order as in `prev` gets that very array, so a
 * row of that folder, memoised on it, is not rendered again when only another folder changed.
 */
export function groupByFolder(
  notes: Item[],
  prev: NotesByFolder,
): NotesByFolder {
  const groups = new Map<string | null, Item[]>();
  for (const note of notes) {
    const group = groups.get(note.folderId);
    if (group) group.push(note);
    else groups.set(note.folderId, [note]);
  }
  for (const [folderId, group] of groups) {
    const old = prev.get(folderId);
    if (
      old &&
      old.length === group.length &&
      old.every((n, at) => n === group[at])
    )
      groups.set(folderId, old);
  }
  return groups;
}

/** How many notes sit in `folder` and in any folder below it. */
export function notesUnder(folder: Folder, byFolder: NotesByFolder): number {
  const inside = `${folder.id}/`;
  let count = 0;
  for (const [folderId, notes] of byFolder)
    if (folderId === folder.id || folderId?.startsWith(inside))
      count += notes.length;
  return count;
}
