// src/lib/mergeScan.ts
import type { Folder, Item } from "../types";

/** Whether two copies of a note read the same (the dates do not count: another editor does not bump them). */
export const sameItem = (a: Item, b: Item) =>
  a.title === b.title &&
  a.body === b.body &&
  a.folderId === b.folderId &&
  a.order === b.order;

/**
 * Brings the notes in memory in line with a fresh scan of the vault: files added on disk appear,
 * files gone from disk disappear, edited ones are replaced. Notes that did not change keep their
 * object, so nothing re-renders for them, and the very same array comes back when nothing differs.
 * `keepId` is the note open in a dirty editor: its text in memory is the user's, so it is left
 * alone (the next autosave wins, as it always did).
 */
export function mergeItems(
  prev: Item[],
  scanned: Item[],
  keepId: string | null,
): Item[] {
  const onDisk = new Map(scanned.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const next: Item[] = [];
  let changed = false;

  for (const old of prev) {
    seen.add(old.id);
    if (old.id === keepId) {
      next.push(old);
      continue;
    }
    const disk = onDisk.get(old.id);
    if (!disk) {
      changed = true;
    } else if (sameItem(old, disk)) {
      next.push(old);
    } else {
      next.push(disk);
      changed = true;
    }
  }
  for (const disk of scanned) {
    if (!seen.has(disk.id)) {
      next.push(disk);
      changed = true;
    }
  }
  return changed ? next : prev;
}

/** Same for folders. A scan gives every folder a new createdAt, so the ones already known are kept as they are. */
export function mergeFolders(prev: Folder[], scanned: Folder[]): Folder[] {
  const known = new Map(prev.map((f) => [f.id, f]));
  const next = scanned.map((f) => {
    const old = known.get(f.id);
    return old && old.parentId === f.parentId && old.order === f.order
      ? old
      : f;
  });
  const unchanged =
    next.length === prev.length && next.every((f) => known.get(f.id) === f);
  return unchanged ? prev : next;
}
