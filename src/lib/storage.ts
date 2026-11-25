// src/lib/storage.ts
// Failure contract: every function that writes for the user REJECTS when the write did not happen (saveItem,
// replaceItemFile, moveItemFile, trashItemFile, restoreItemFile, emptyTrashFiles, createFolderDir, renameFolderDir,
// moveFolderDir, deleteFolderDir, restoreFolderDir, writeFolderOrder), and never reports it itself: the hooks know the title and offer Retry (see
// lib/reportError). A thing that is already as wanted is no failure (trashing or moving a file that is not there).
// Best-effort steps only console.warn and never fail the write they follow: removing the old file after
// replaceItemFile has saved the new one, removing the trash copy after a restore, sweepUnusedImages, and a trashed file
// that cannot be read when the trash is listed.
// A write never makes the vault's own folder (lib/vaultRoot): anything that is about to `mkdir` calls requireRoot first, and rejects
// when the vault folder is not there, instead of recreating it as an empty vault.
// Loading: loadVault lists the vault through the Rust scan (lib/vaultScan) and returns every note WITHOUT its text (`unloaded`);
// the texts are read afterwards (hooks/useBodies). A note that is not loaded is never written: writeItem rejects it, so no path
// (save, rename, restore) can replace a file with an empty note. rescanVault is the focus rescan: it reads only the files that
// changed. The trash is not part of the load: loadTrash lists it when the Trash view opens (the Rust `scan_trash`, one call, no texts).
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { Folder, Item } from "../types";
import { type AtomicFs, writeAtomic } from "./atomicWrite";
import { ATTACH_DIR, unusedImages } from "./attachments";
import { serializeItem } from "./fileFormat";
import { folderAbsPath, itemFileName, itemFilePath } from "./itemPaths";
import { changedNotes } from "./mergeScan";
import { joinPath } from "./paths";
import { perfMark } from "./perf";
import { requireRoot, rootLost, rootSeen } from "./vaultRoot";
import {
  type FileStamp,
  foldersFromScan,
  itemFromScan,
  readBodies,
  type ScannedNote,
  scanTrash,
  scanVault,
  stampOf,
} from "./vaultScan";

// The path helpers moved to lib/itemPaths (the MCP server uses them too); callers keep importing them from here
export { folderAbsPath, itemFilePath };

const TRASH_DIR = ".trash";
// The chosen order of folders: { "<folderId>": rank }. A folder is a directory with no file to hold it
// (notes keep theirs in their frontmatter). Dot entries are not part of the scan, so this one stays out of sight.
const FOLDER_ORDER_FILE = ".folder-order.json";

// ---------------------------------------------------------------------------
// Write tracking: a rescan of the vault (see loadVault) is only trusted when no write
// of ours started, ended or ran during it, or it could see a file mid-rename and drop the note.
// ---------------------------------------------------------------------------

let writeSeq = 0;
let writesPending = 0;
// Writes also run one at a time, in the order they were asked for: replaceItemFile writes the new file before it
// removes the old one, so a folder rename or a move of the same note running beside it could fail or bring the old text back
let queue: Promise<unknown> = Promise.resolve();

/** Runs `op` after every write asked for before it. Never call it from inside another `tracked` op: that would wait for itself. */
async function tracked<T>(op: () => Promise<T>): Promise<T> {
  writeSeq++;
  writesPending++;
  const run = queue.then(op);
  queue = run.catch(() => {});
  try {
    return await run;
  } finally {
    writesPending--;
    writeSeq++;
  }
}

/** A snapshot to compare before and after a scan: equal and `pending` 0 on both sides means no write touched it. */
export function writeState(): { seq: number; pending: number } {
  return { seq: writeSeq, pending: writesPending };
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function trashFilePath(vaultPath: string, item: Item): string {
  return joinPath(vaultPath, TRASH_DIR, itemFileName(item));
}

/** Move a file or directory into <vault>/.trash. A name clash (two loose notes.txt from different folders) keeps both. Gives where it went. */
async function moveToTrash(
  vaultPath: string,
  absPath: string,
): Promise<string> {
  const trashDir = joinPath(vaultPath, TRASH_DIR);
  await requireRoot(vaultPath);
  await mkdir(trashDir, { recursive: true });
  // absPath always comes from joinPath, so it uses "/"
  const name = absPath.slice(absPath.lastIndexOf("/") + 1);
  let dest = joinPath(trashDir, name);
  if (await exists(dest)) dest = joinPath(trashDir, `${Date.now()}-${name}`);
  await rename(absPath, dest);
  return dest;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

// A note is replaced whole through a temp file (see lib/atomicWrite), whatever writes it
const tauriFs: AtomicFs = { writeText: writeTextFile, rename, remove };

// The folders a save has made sure of, so the next save into one skips the `mkdir` call (a trip to Rust on every autosave).
// Absolute paths, so two vaults never share an entry. A folder renamed or deleted here drops its entry and those under it,
// a write that fails drops its folder's, and every scan forgets them all: something outside the app may have removed a
// folder, and the first save into it makes it again.
const madeDirs = new Set<string>();

function forgetDirs(under?: string): void {
  for (const dir of madeDirs)
    if (under === undefined || dir === under || dir.startsWith(`${under}/`))
      madeDirs.delete(dir);
}

/**
 * The one note write: not tracked, so the tracked functions below can share it. It refuses a note whose text has not been read
 * (`unloaded`): its body is "" and writing it would replace the file with an empty note. Every write of a note comes through here.
 */
async function writeItem(vaultPath: string, item: Item): Promise<void> {
  if (item.unloaded)
    throw new Error(
      `The text of "${item.title}" has not been read yet, so it was not saved`,
    );
  await requireRoot(vaultPath); // never makes the vault folder itself: below it a missing folder is made, as before
  const dir =
    item.folderId !== null ? joinPath(vaultPath, item.folderId) : vaultPath;
  if (item.folderId !== null && !madeDirs.has(dir)) {
    await mkdir(dir, { recursive: true });
    madeDirs.add(dir);
  }
  try {
    await writeAtomic(
      tauriFs,
      itemFilePath(vaultPath, item),
      serializeItem(item),
    );
  } catch (err) {
    // the folder may be what is wrong (the vault's too): look again next time
    madeDirs.delete(dir);
    rootLost(vaultPath);
    await requireRoot(vaultPath); // the vault folder itself is what is gone: say so, not the system's error
    throw err;
  }
}

export function saveItem(vaultPath: string, item: Item): Promise<void> {
  return tracked(() => writeItem(vaultPath, item));
}

/**
 * Save `updated`; if its file path differs from `old` (title or folder changed), remove the old file after.
 * The new file comes first, so a failed write leaves the old note as it was. If the old file then cannot be
 * removed the save still stands, and both files exist (the same id twice) until something removes the old one.
 */
export function replaceItemFile(
  vaultPath: string,
  old: Item,
  updated: Item,
): Promise<void> {
  return tracked(async () => {
    await writeItem(vaultPath, updated);
    // Paths that differ only in case are one file on Windows and macOS (a folder renamed "Work" to "work"): never remove that
    if (
      itemFilePath(vaultPath, old).toLowerCase() ===
      itemFilePath(vaultPath, updated).toLowerCase()
    )
      return;
    try {
      await deleteItemFile(vaultPath, old);
    } catch (err) {
      console.warn("[storage] could not remove the old note file:", err);
    }
  });
}

/** Hard remove, for the stale file left behind by a rename (not tracked: it runs inside replaceItemFile). A user delete goes through trashItemFile. */
async function deleteItemFile(vaultPath: string, item: Item): Promise<void> {
  const filePath = itemFilePath(vaultPath, item);
  if (await exists(filePath)) await remove(filePath);
}

/** A note that is not there is nothing to move, not a failure. */
export function moveItemFile(
  vaultPath: string,
  item: Item,
  newFolderId: string | null,
): Promise<void> {
  return tracked(async () => {
    const oldPath = itemFilePath(vaultPath, item);
    const newDir =
      newFolderId !== null ? joinPath(vaultPath, newFolderId) : vaultPath;

    await requireRoot(vaultPath);
    if (newFolderId !== null) await mkdir(newDir, { recursive: true });

    const newPath = joinPath(newDir, itemFileName(item));
    if (oldPath !== newPath && (await exists(oldPath)))
      await rename(oldPath, newPath);
  });
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

/** A note that is not there is already gone, not a failure. */
export function trashItemFile(vaultPath: string, item: Item): Promise<void> {
  return tracked(async () => {
    const filePath = itemFilePath(vaultPath, item);
    if (await exists(filePath)) await moveToTrash(vaultPath, filePath);
  });
}

/** The trash as the Rust scan lists it: the notes without their text (`unloaded`) and where each one's file is, to read the text when it is needed. */
export interface TrashLoad {
  items: Item[];
  files: Map<string, FileStamp>;
}

/**
 * The notes directly in <vault>/.trash, from the Rust `scan_trash` in ONE call: metadata only, so listing a big trash is quick and
 * holds no texts. Loose files and deleted folders stay out of sight, as does a file with no id. Read when the Trash view opens, not
 * at start (only the count is known before: the scan's `trashCount`). A note is read with `readBodies` (from `files`) when it is
 * restored or deleted for good, since Restore writes the text back and a note that is not loaded is never written. Rejects when
 * the trash cannot be listed (not the same as an empty trash).
 */
export async function loadTrash(vaultPath: string): Promise<TrashLoad> {
  let notes: ScannedNote[];
  try {
    notes = await scanTrash(vaultPath);
  } catch (err) {
    // invoke rejects with a string
    throw err instanceof Error ? err : new Error(String(err));
  }
  return {
    items: notes.map((note) => itemFromScan(note)),
    files: new Map(notes.map((note) => [note.id, stampOf(note)])),
  };
}

/** Put a trashed item back. Returns the item as restored: its folder may be gone, then it lands in the vault root. */
export function restoreItemFile(vaultPath: string, item: Item): Promise<Item> {
  return tracked(async () => {
    const folderExists =
      item.folderId === null ||
      (await exists(folderAbsPath(vaultPath, item.folderId)));
    const restored = folderExists ? item : { ...item, folderId: null };
    await writeItem(vaultPath, restored); // write first, so a crash never loses it
    try {
      await remove(trashFilePath(vaultPath, item));
    } catch (err) {
      // Restored all the same; the scan hides a trashed note whose id is live
      console.warn("[storage] could not remove the trash copy:", err);
    }
    return restored;
  });
}

/**
 * Delete the listed items from the trash for good. Loose files and folder leftovers
 * are never listed, so they stay. Every file is tried; rejects if one could not be removed.
 */
export function emptyTrashFiles(
  vaultPath: string,
  items: Item[],
): Promise<void> {
  return tracked(async () => {
    const results = await Promise.allSettled(
      items.map(async (item) => {
        const path = trashFilePath(vaultPath, item);
        if (await exists(path)) await remove(path);
      }),
    );
    const failed = results.find((r) => r.status === "rejected");
    if (failed) throw failed.reason;
  });
}

/**
 * The text of every .md in the vault and in .trash, to see which images are still linked. Other dot
 * folders are not part of the vault. Unlike the scan, this throws on anything it cannot read: not
 * knowing what is linked must end in deleting nothing. ponytail: links from non-.md files are not seen.
 */
async function readAllNotesText(
  vaultPath: string,
  dir: string,
): Promise<string> {
  const parts: string[] = [];
  for (const entry of await readDir(dir)) {
    if (!entry.name) continue;
    const absPath = joinPath(dir, entry.name);
    if (entry.isDirectory) {
      const skip = entry.name.startsWith(".")
        ? entry.name !== TRASH_DIR
        : dir === vaultPath && entry.name.toLowerCase() === ATTACH_DIR;
      if (!skip) parts.push(await readAllNotesText(vaultPath, absPath));
    } else if (entry.isFile && entry.name.toLowerCase().endsWith(".md")) {
      parts.push(await readTextFile(absPath));
    }
  }
  return parts.join("\n");
}

/**
 * Deletes the images in <vault>/attachments that no note links to any more. Meant to run right after
 * the trash is emptied, when the notes that used them are gone. A failure or a save of ours during the
 * scan means nothing is deleted; the next empty trash tries again. `only` (file names) narrows it to those pictures: what one note
 * left behind when it was deleted for good, so a vault of other loose files loses none of them.
 */
export async function sweepUnusedImages(
  vaultPath: string,
  only?: readonly string[],
): Promise<void> {
  const dir = joinPath(vaultPath, ATTACH_DIR);
  try {
    if (!(await exists(dir))) return;
    const wanted = only && new Set(only.map((n) => n.toLowerCase()));
    const files = (await readDir(dir))
      .filter((e) => e.isFile && e.name)
      .map((e) => e.name)
      .filter((name) => !wanted || wanted.has(name.toLowerCase()));
    if (files.length === 0) return;
    const before = writeState();
    if (before.pending) return;
    const unused = unusedImages(
      files,
      await readAllNotesText(vaultPath, vaultPath),
    );
    const after = writeState();
    if (after.pending || after.seq !== before.seq) return;
    await Promise.allSettled(unused.map((name) => remove(joinPath(dir, name))));
  } catch (err) {
    console.warn("[storage] sweepUnusedImages failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

/**
 * Saves the folders' order: the ranks of the folders that have one, whole, so a rename or a delete never
 * leaves a stale key behind. With no rank left the file goes away.
 */
export function writeFolderOrder(
  vaultPath: string,
  folders: Folder[],
): Promise<void> {
  return tracked(async () => {
    const ranks = Object.fromEntries(
      folders.flatMap((f) => (f.order === undefined ? [] : [[f.id, f.order]])),
    );
    const path = joinPath(vaultPath, FOLDER_ORDER_FILE);
    if (Object.keys(ranks).length > 0)
      await writeAtomic(tauriFs, path, JSON.stringify(ranks, null, 2));
    else if (await exists(path)) await remove(path);
  });
}

/** What the scan found, ready for the first paint: every note listed, no text read, no trash read. */
export interface VaultLoad {
  /** Every note without its text (`unloaded`); useBodies reads the texts afterwards. */
  items: Item[];
  folders: Folder[];
  /** `.md` files in .trash, counted and not read (loadTrash lists them when the Trash view opens). */
  trashCount: number;
  /** The file each note was found in, by id: to read its text and to see later what changed. */
  files: Map<string, FileStamp>;
}

/**
 * The Rust scan of a vault, and the one place that knows its folder is there: a scan that lists it marks it as seen (a write may
 * then make folders below it), one that fails forgets it (the next write looks again, see lib/vaultRoot). A vault was opened, came
 * back or was rescanned, so its folders are looked at again too.
 */
async function scanRoot(vaultPath: string) {
  forgetDirs();
  try {
    const scan = await scanVault(vaultPath);
    rootSeen(vaultPath);
    return scan;
  } catch (err) {
    rootLost(vaultPath);
    // invoke rejects with a string
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * Lists the vault in one call to the Rust scan. A vault folder that cannot be read rejects: it must not look like an empty vault
 * (the lists would be emptied and the next save would create the folder again), and the caller shows VaultUnavailable.
 */
export async function loadVault(vaultPath: string): Promise<VaultLoad> {
  const scan = await scanRoot(vaultPath);
  perfMark("scan-done");
  return {
    items: scan.notes.map((note) => itemFromScan(note)),
    folders: foldersFromScan(scan.folders),
    trashCount: scan.trashCount,
    files: new Map(scan.notes.map((note) => [note.id, stampOf(note)])),
  };
}

/** A rescan: the whole scan, and the text of just the notes that are new or whose file is not what `known` saw. */
export interface Rescan {
  notes: ScannedNote[];
  folders: Folder[];
  /** The ids whose text was asked for, and the text of those that could be read (a failed read is tried again next time). */
  read: Set<string>;
  bodies: Map<string, string>;
}

/** `known`: the files seen by the last scan; `inMemory`: the ids of the notes on screen. Rejects like loadVault. */
export async function rescanVault(
  vaultPath: string,
  known: ReadonlyMap<string, FileStamp>,
  inMemory: ReadonlySet<string>,
): Promise<Rescan> {
  const scan = await scanRoot(vaultPath); // outside edits may have removed a folder
  const changed = changedNotes(scan.notes, known, inMemory);
  const { bodies, errors } = await readBodies(
    vaultPath,
    changed.map((note) => note.id),
    new Map(changed.map((note) => [note.id, stampOf(note)])),
  );
  if (errors.size > 0)
    console.warn("[storage] could not read changed notes:", [...errors]);
  return {
    notes: scan.notes,
    folders: foldersFromScan(scan.folders),
    read: new Set(changed.map((note) => note.id)),
    bodies,
  };
}

export function createFolderDir(
  vaultPath: string,
  folder: Folder,
): Promise<void> {
  return tracked(async () => {
    await requireRoot(vaultPath);
    await mkdir(folderAbsPath(vaultPath, folder.id), { recursive: true });
  });
}

async function renameDir(
  vaultPath: string,
  oldId: string,
  newId: string,
): Promise<void> {
  const oldAbs = folderAbsPath(vaultPath, oldId);
  forgetDirs(oldAbs);
  await rename(oldAbs, folderAbsPath(vaultPath, newId));
}

export function renameFolderDir(
  vaultPath: string,
  oldId: string,
  newName: string,
): Promise<void> {
  const slashIdx = oldId.lastIndexOf("/");
  const newId =
    slashIdx > 0 ? `${oldId.slice(0, slashIdx)}/${newName}` : newName;
  return tracked(() => renameDir(vaultPath, oldId, newId));
}

/**
 * A folder under another parent (`newId` is its new path, the new parent being a folder that exists): the directory moves with
 * every file in it. The notes' own paths and links are the caller's to follow (lib/folderOps, useFolders).
 */
export function moveFolderDir(
  vaultPath: string,
  oldId: string,
  newId: string,
): Promise<void> {
  return tracked(() => renameDir(vaultPath, oldId, newId));
}

/**
 * Items are moved out first, so what is left is non-Graphene files: keep them in .trash instead of erasing them. Gives where the
 * directory went (null when there was none), which is what restoreFolderDir needs.
 */
export function deleteFolderDir(
  vaultPath: string,
  folderId: string,
): Promise<string | null> {
  return tracked(async () => {
    const absPath = folderAbsPath(vaultPath, folderId);
    forgetDirs(absPath);
    return (await exists(absPath)) ? moveToTrash(vaultPath, absPath) : null;
  });
}

/**
 * The Undo of deleteFolderDir: the directory comes back from `trashPath` (what deleteFolderDir gave), with whatever else was in
 * it, and every folder in `folderIds` is made if it is still missing (the first is the deleted folder itself). Rejects, with
 * nothing changed, when something already sits where the folder was.
 */
export function restoreFolderDir(
  vaultPath: string,
  folderIds: string[],
  trashPath: string | null,
): Promise<void> {
  return tracked(async () => {
    const root = folderAbsPath(vaultPath, folderIds[0]);
    await requireRoot(vaultPath);
    if (await exists(root)) throw new Error(`"${folderIds[0]}" exists again`);
    if (trashPath !== null && (await exists(trashPath)))
      await rename(trashPath, root);
    for (const id of folderIds)
      await mkdir(folderAbsPath(vaultPath, id), { recursive: true });
  });
}
