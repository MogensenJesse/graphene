// src/lib/vaultScan.ts
// The Rust startup path (src-tauri/src/vault_scan.rs): one call lists a vault (metadata only), another reads note bodies in batches.
//
// scanVault(vaultPath) -> ScanResult, in ONE IPC call. It replaced the TypeScript walker of storage.ts (scanVaultRecursive + readItemFile; loadVault and rescanVault call it now); same rules as mcp/vault.ts,
// which are all tested against fixtures/vault: dot entries and the root `attachments` folder (any case) are skipped, only `.md` files
// count, a file with no id is no note, symlinks are not followed, an unreadable subfolder or file is skipped, and two files with one id
// give one note (the last file, at the place of the first).
//   - It REJECTS (with a string, not an Error: that is what invoke gives) when the vault root cannot be read or is not an allowed vault
//     folder, so a missing folder never looks like an empty vault. Wrap it where an Error is wanted.
//   - Order: depth first, the entries of each folder sorted by lower-case name (then by name), folders and notes together. `notes`
//     and `folders` each keep that order. The TS scan has the order of readDir; nothing may depend on either (the lists are sorted for
//     display), but a repeated id resolves by it.
//   - `notes[i].path` is relative to the vault with "/" (the file's own name, not necessarily `slug-id.md`): the file is
//     joinPath(vaultPath, path), and that absolute path is what readNotes takes. `folderId` is the folder the file sits in (its path), or
//     the frontmatter's for a note at the root (so a root note can name a folder that does not exist, as in storage.ts).
//   - `createdAt` / `updatedAt` are null when the file has no such line (parseNoteFile then uses the current time: itemFromScan does the
//     same); a line with no value is "". `order` is there only when the file has a finite rank.
//   - `kind` is itemKind of the body ("code" starts with a fenced block), so the sidebar icon is right before any body is read.
//   - `mtimeMs` (whole milliseconds) and `size` (bytes) are those of the file when it was scanned, for the rescan that reads only what
//     changed (a file that changed while it was scanned shows an older mtime than its text, which only causes one extra read).
//   - `folders` carry their rank from .folder-order.json; foldersFromScan adds the createdAt a Folder has (the time of the scan, as
//     foldersFromDirs does). `trashCount` counts the `.md` files directly in `.trash` without parsing them, so it can be above what the
//     trash view lists (a note with no id, or one whose id is also live).
//
// readNotes(paths) -> one entry per path, in the order asked: { text } is the body exactly as parseNoteFile(raw).body would give it
// (frontmatter, byte order mark and CR of CRLF gone; what Item.body holds), or { error } for that path alone (not allowed, not a `.md`
// file, unreadable). The call itself rejects only if the command cannot run. The caller chooses the batch size (a few hundred notes is
// one IPC call of a few MB); run one batch at a time, each is already parallel in Rust.
//
// scanTrash(vaultPath) -> the notes directly in `<vault>/.trash`, in ONE call, as ScannedNote (no text: the Trash view reads it with
// readNotes). Same rules as the scan for that one folder (`.md` only, no id no note, symlinks not followed, a repeated id gives the last file),
// but a note's `folderId` is the one its frontmatter remembers (where it was before it was trashed), its `path` is `.trash/<name>`, and a
// dot name counts, as in `trashCount`. A vault with no `.trash` gives []; a vault or trash folder that cannot be read, or is not allowed, rejects.
//
// SECURITY: these commands bypass the fs plugin's capability scope, and the webview renders user Markdown, so Rust checks every path
// against the fs scope (the vault folders from config.json at start, plus what the folder picker grants): a path must be absolute, free
// of "..", and inside an allowed vault folder once links are resolved; readNotes reads nothing but `.md` files.
import { invoke } from "@tauri-apps/api/core";
import type { Folder, Item, ItemKind } from "../types";
import { joinPath } from "./paths";

export interface ScannedNote {
  id: string;
  title: string;
  folderId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  order?: number;
  kind: ItemKind;
  path: string;
  mtimeMs: number;
  size: number;
}

export interface ScannedFolder {
  id: string;
  name: string;
  parentId: string | null;
  order?: number;
}

export interface ScanResult {
  notes: ScannedNote[];
  folders: ScannedFolder[];
  trashCount: number;
}

export type NoteRead = { text: string } | { error: string };
export type ReadNotesResult = NoteRead[];

export function scanVault(vaultPath: string): Promise<ScanResult> {
  return invoke<ScanResult>("scan_vault", { path: vaultPath });
}

export function readNotes(paths: string[]): Promise<ReadNotesResult> {
  return invoke<ReadNotesResult>("read_notes", { paths });
}

export function scanTrash(vaultPath: string): Promise<ScannedNote[]> {
  return invoke<ScannedNote[]>("scan_trash", { path: vaultPath });
}

/**
 * An Item from the scan. Without `body` it is `unloaded` (body "", the scan's kind): the text comes later through readBodies
 * and nothing may write the note before it has. With `body` it is a whole note. A date the file lacks is now, as parseNoteFile does.
 */
export function itemFromScan(note: ScannedNote, body?: string): Item {
  const now = new Date().toISOString();
  return {
    id: note.id,
    title: note.title,
    folderId: note.folderId,
    createdAt: note.createdAt ?? now,
    updatedAt: note.updatedAt ?? now,
    ...(note.order === undefined ? {} : { order: note.order }),
    body: body ?? "",
    ...(body === undefined ? { unloaded: { kind: note.kind } } : {}),
  };
}

/** Where a note's file was and what it looked like at the scan: a later scan reads the note again only when this changed. */
export interface FileStamp {
  path: string;
  mtimeMs: number;
  size: number;
}

export const stampOf = ({ path, mtimeMs, size }: ScannedNote): FileStamp => ({
  path,
  mtimeMs,
  size,
});

/** Notes per readNotes call in the background load: a few hundred is a few MB, small enough to parse between two frames, and at most about 20 state updates for a big vault. */
export function batchSize(total: number): number {
  return Math.min(2000, Math.max(300, Math.ceil(total / 20)));
}

/**
 * The text of the notes `ids` (files known from `stamps`), `batch` per readNotes call, one call after the other. `bodies` has the
 * notes that were read, `errors` the rest, by id, with the reason. Never rejects: a note whose file is not known, one that could not
 * be read and a failed call all end up in `errors`.
 */
export async function readBodies(
  vaultPath: string,
  ids: string[],
  stamps: ReadonlyMap<string, FileStamp>,
  batch = 500,
): Promise<{ bodies: Map<string, string>; errors: Map<string, string> }> {
  const bodies = new Map<string, string>();
  const errors = new Map<string, string>();
  const files = ids.flatMap((id) => {
    const stamp = stamps.get(id);
    if (stamp) return [{ id, path: joinPath(vaultPath, stamp.path) }];
    errors.set(id, "the file of the note is not known");
    return [];
  });
  for (let at = 0; at < files.length; at += batch) {
    const chunk = files.slice(at, at + batch);
    try {
      const reads = await readNotes(chunk.map((f) => f.path));
      chunk.forEach(({ id }, i) => {
        const read = reads[i];
        if (read && "text" in read) bodies.set(id, read.text);
        else errors.set(id, read ? read.error : "no answer");
      });
    } catch (err) {
      for (const { id } of chunk) errors.set(id, String(err));
    }
  }
  return { bodies, errors };
}

/** The Folders of a scan: foldersFromDirs gave each the time of the scan as createdAt, and so does this. */
export function foldersFromScan(folders: ScannedFolder[]): Folder[] {
  const now = new Date().toISOString();
  return folders.map((folder) => ({ ...folder, createdAt: now }));
}
