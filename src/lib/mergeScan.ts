// src/lib/mergeScan.ts
import type { Folder, Item } from "../types";
import {
  type FileStamp,
  itemFromScan,
  type ScannedNote,
  stampOf,
} from "./vaultScan";

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
 * `keep` holds the notes whose text in memory is the user's and is not on disk as it is: the one open
 * in a dirty editor, and those whose newest write failed. They are left alone, even when gone or
 * changed on disk (the next autosave or Retry wins, as it always did).
 */
export function mergeItems(
  prev: Item[],
  scanned: Item[],
  keep: ReadonlySet<string>,
): Item[] {
  const onDisk = new Map(scanned.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const next: Item[] = [];
  let changed = false;

  for (const old of prev) {
    seen.add(old.id);
    if (keep.has(old.id)) {
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

/**
 * Puts the texts that were read into the notes that are still waiting for theirs (`unloaded`), and returns the same array when
 * none changed. A note that is loaded already is left alone: it may have been typed in, saved or changed on disk since the scan,
 * and a text that was read before that must not replace it. `keep` (the notes whose write failed) is left alone too.
 */
export function applyBodies(
  prev: Item[],
  bodies: ReadonlyMap<string, string>,
  keep: ReadonlySet<string>,
): Item[] {
  let changed = false;
  const next = prev.map((item) => {
    const text = bodies.get(item.id);
    if (text === undefined || !item.unloaded || keep.has(item.id)) return item;
    changed = true;
    const { unloaded: _waiting, ...loaded } = item;
    return { ...loaded, body: text };
  });
  return changed ? next : prev;
}

/**
 * The notes of a fresh scan whose text has to be read: those that are new, those whose file is not the one last seen (another
 * place, time or size, from `known`), and those that are not in memory. The others are what they were.
 */
export function changedNotes(
  scanned: ScannedNote[],
  known: ReadonlyMap<string, FileStamp>,
  inMemory: ReadonlySet<string>,
): ScannedNote[] {
  return scanned.filter((note) => {
    const seen = known.get(note.id);
    return (
      !seen ||
      !inMemory.has(note.id) ||
      seen.path !== note.path ||
      seen.mtimeMs !== note.mtimeMs ||
      seen.size !== note.size
    );
  });
}

/**
 * A fresh scan as the notes `mergeItems` compares with memory: a note that was read is built from the scan and its text, one that
 * was not (its file is as it was, or it could not be read) is the note in memory, and a new one that could not be read is left out
 * (the next scan finds it again).
 */
export function itemsFromRescan(
  prev: Item[],
  scanned: ScannedNote[],
  bodies: ReadonlyMap<string, string>,
): Item[] {
  const before = new Map(prev.map((item) => [item.id, item]));
  return scanned.flatMap((note) => {
    const text = bodies.get(note.id);
    if (text !== undefined) return [itemFromScan(note, text)];
    const old = before.get(note.id);
    return old ? [old] : [];
  });
}

/**
 * What to remember of a scan for the next one: a stamp per note. A note the scan was not applied to (a kept one, or one that
 * had to be read and could not be) keeps the stamp it had, so its file still counts as changed and is read again next time.
 */
export function stampsAfter(
  known: ReadonlyMap<string, FileStamp>,
  scanned: ScannedNote[],
  toRead: ReadonlySet<string>,
  bodies: ReadonlyMap<string, string>,
  keep: ReadonlySet<string>,
): Map<string, FileStamp> {
  const next = new Map<string, FileStamp>();
  for (const note of scanned) {
    const stamp =
      keep.has(note.id) || (toRead.has(note.id) && !bodies.has(note.id))
        ? known.get(note.id)
        : stampOf(note);
    if (stamp) next.set(note.id, stamp);
  }
  return next;
}

/**
 * The trash as it is on disk plus the notes trashed since the vault was opened (`known`, which have their text loaded and win),
 * without a note whose id is live again (a restored note whose trash copy is not gone yet).
 */
export function mergeTrash(
  known: Item[],
  onDisk: Item[],
  live: ReadonlySet<string>,
): Item[] {
  const have = new Set(known.map((item) => item.id));
  return [
    ...known,
    ...onDisk.filter((item) => !have.has(item.id) && !live.has(item.id)),
  ];
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
