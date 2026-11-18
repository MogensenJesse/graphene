// src/lib/storage.ts
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
import { ATTACH_DIR, unusedImages } from "./attachments";
import { parseNoteFile, serializeItem } from "./fileFormat";
import { joinPath, relativePath } from "./paths";

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

async function tracked<T>(op: () => Promise<T>): Promise<T> {
  writeSeq++;
  writesPending++;
  try {
    return await op();
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

/** Sanitize a title into a safe, readable filename segment (max 50 chars). */
function slugify(title: string): string {
  const base = title.trim() || "untitled";
  const slug = base
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return slug || "untitled";
}

/** Derive folder id (relative path from vault) from a file's absolute path */
function folderIdFromFilePath(
  vaultPath: string,
  fileAbsPath: string,
): string | null {
  const rel = relativePath(vaultPath, fileAbsPath);
  const slashIdx = rel.lastIndexOf("/");
  if (slashIdx < 0) return null; // file is at vault root
  return rel.slice(0, slashIdx);
}

/** Build absolute path for a folder id (which is a relative path from vault) */
export function folderAbsPath(vaultPath: string, folderId: string): string {
  return joinPath(vaultPath, folderId);
}

function itemFileName(item: Item): string {
  return `${slugify(item.title)}-${item.id}.md`;
}

/** Determine absolute path for an item file */
export function itemFilePath(vaultPath: string, item: Item): string {
  const dir =
    item.folderId !== null ? joinPath(vaultPath, item.folderId) : vaultPath;
  return joinPath(dir, itemFileName(item));
}

function trashFilePath(vaultPath: string, item: Item): string {
  return joinPath(vaultPath, TRASH_DIR, itemFileName(item));
}

/** Move a file or directory into <vault>/.trash. A name clash (two loose notes.txt from different folders) keeps both. */
async function moveToTrash(vaultPath: string, absPath: string): Promise<void> {
  const trashDir = joinPath(vaultPath, TRASH_DIR);
  await mkdir(trashDir, { recursive: true });
  // absPath always comes from joinPath, so it uses "/"
  const name = absPath.slice(absPath.lastIndexOf("/") + 1);
  let dest = joinPath(trashDir, name);
  if (await exists(dest)) dest = joinPath(trashDir, `${Date.now()}-${name}`);
  await rename(absPath, dest);
}

// ---------------------------------------------------------------------------
// Recursive directory scanner
// ---------------------------------------------------------------------------

interface ScannedFile {
  absPath: string;
  name: string;
}

interface ScannedDir {
  absPath: string;
  relPath: string; // relative to vault root
}

async function scanVaultRecursive(
  vaultPath: string,
  currentAbsPath: string,
): Promise<{ files: ScannedFile[]; dirs: ScannedDir[] }> {
  const files: ScannedFile[] = [];
  const dirs: ScannedDir[] = [];

  let entries: { name: string; isFile: boolean; isDirectory: boolean }[];
  try {
    entries = await readDir(currentAbsPath);
  } catch {
    return { files, dirs };
  }

  for (const entry of entries) {
    if (!entry.name) continue;
    // Dot entries (.trash, .git, .obsidian) are not part of the vault's content
    if (entry.name.startsWith(".")) continue;
    // The images folder at the vault root is no note folder (see lib/attachments)
    if (
      entry.isDirectory &&
      currentAbsPath === vaultPath &&
      entry.name.toLowerCase() === ATTACH_DIR
    )
      continue;
    const absPath = joinPath(currentAbsPath, entry.name);

    if (entry.isDirectory) {
      const relPath = relativePath(vaultPath, absPath);
      dirs.push({ absPath, relPath });
      const sub = await scanVaultRecursive(vaultPath, absPath);
      files.push(...sub.files);
      dirs.push(...sub.dirs);
    } else if (entry.isFile) {
      files.push({ absPath, name: entry.name });
    }
  }

  return { files, dirs };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

async function readItemFile(
  vaultPath: string,
  { absPath, name }: ScannedFile,
): Promise<Item | null> {
  if (!name.toLowerCase().endsWith(".md")) return null;
  const parsed = parseNoteFile(await readTextFile(absPath));
  if (!parsed.id) return null;
  // The folder a note sits in wins over the one its frontmatter remembers
  return {
    ...parsed,
    folderId: folderIdFromFilePath(vaultPath, absPath) ?? parsed.folderId,
  };
}

const READ_POOL = 16;

async function itemsFromFiles(
  vaultPath: string,
  files: ScannedFile[],
): Promise<Item[]> {
  // A few reads at a time (each is a call into Tauri); results keep the scan order, so the
  // duplicate-id handling in loadVault sees the same sequence as before
  const results: (Item | null)[] = new Array(files.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const at = next++;
      try {
        results[at] = await readItemFile(vaultPath, files[at]);
      } catch (err) {
        console.warn(
          "[storage] Failed to read item file:",
          files[at].absPath,
          err,
        );
      }
    }
  };
  await Promise.all(Array.from({ length: READ_POOL }, worker));
  return results.filter((i): i is Item => i !== null);
}

export function saveItem(vaultPath: string, item: Item): Promise<void> {
  return tracked(async () => {
    const dir =
      item.folderId !== null ? joinPath(vaultPath, item.folderId) : vaultPath;
    await mkdir(dir, { recursive: true });
    await writeTextFile(itemFilePath(vaultPath, item), serializeItem(item));
  });
}

/** Save `updated`; if its file path differs from `old` (title or folder changed), remove the old file first. */
export async function replaceItemFile(
  vaultPath: string,
  old: Item,
  updated: Item,
): Promise<void> {
  if (itemFilePath(vaultPath, old) !== itemFilePath(vaultPath, updated)) {
    await deleteItemFile(vaultPath, old);
  }
  await saveItem(vaultPath, updated);
}

/** Hard remove, for the stale file left behind by a rename. A user delete goes through trashItemFile. */
function deleteItemFile(vaultPath: string, item: Item): Promise<void> {
  return tracked(async () => {
    const filePath = itemFilePath(vaultPath, item);
    try {
      const fileExists = await exists(filePath);
      if (fileExists) await remove(filePath);
    } catch (err) {
      console.warn("[storage] deleteItemFile failed:", filePath, err);
    }
  });
}

export function moveItemFile(
  vaultPath: string,
  item: Item,
  newFolderId: string | null,
): Promise<void> {
  return tracked(async () => {
    const oldPath = itemFilePath(vaultPath, item);
    const newDir =
      newFolderId !== null ? joinPath(vaultPath, newFolderId) : vaultPath;

    await mkdir(newDir, { recursive: true });

    const newPath = joinPath(newDir, itemFileName(item));

    try {
      const fileExists = await exists(oldPath);
      if (fileExists && oldPath !== newPath) {
        await rename(oldPath, newPath);
      }
    } catch (err) {
      console.warn(
        "[storage] moveItemFile failed:",
        oldPath,
        "→",
        newPath,
        err,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

export function trashItemFile(vaultPath: string, item: Item): Promise<void> {
  return tracked(async () => {
    const filePath = itemFilePath(vaultPath, item);
    try {
      if (await exists(filePath)) await moveToTrash(vaultPath, filePath);
    } catch (err) {
      console.warn("[storage] trashItemFile failed:", filePath, err);
    }
  });
}

/** Items in <vault>/.trash. Not recursive: loose files and deleted folders stay out of sight. */
async function loadTrash(vaultPath: string): Promise<Item[]> {
  const trashDir = joinPath(vaultPath, TRASH_DIR);
  let entries: { name: string; isFile: boolean }[];
  try {
    entries = await readDir(trashDir);
  } catch {
    return [];
  }

  const items: Item[] = [];
  for (const entry of entries) {
    if (!entry.isFile || !entry.name.toLowerCase().endsWith(".md")) continue;
    try {
      // folderId comes from the frontmatter: the path would just say ".trash"
      const parsed = parseNoteFile(
        await readTextFile(joinPath(trashDir, entry.name)),
      );
      if (parsed.id) items.push(parsed);
    } catch (err) {
      console.warn("[storage] Failed to read trashed file:", entry.name, err);
    }
  }
  return items;
}

/** Put a trashed item back. Returns the item as restored: its folder may be gone, then it lands in the vault root. */
export function restoreItemFile(vaultPath: string, item: Item): Promise<Item> {
  return tracked(async () => {
    const folderExists =
      item.folderId === null ||
      (await exists(folderAbsPath(vaultPath, item.folderId)));
    const restored = folderExists ? item : { ...item, folderId: null };
    await saveItem(vaultPath, restored); // write first, so a crash never loses it
    await remove(trashFilePath(vaultPath, item));
    return restored;
  });
}

/**
 * Delete the listed items from the trash for good. Loose files and folder leftovers
 * are never listed, so they stay.
 */
export function emptyTrashFiles(
  vaultPath: string,
  items: Item[],
): Promise<void> {
  return tracked(async () => {
    await Promise.allSettled(
      items.map(async (item) => {
        const path = trashFilePath(vaultPath, item);
        if (await exists(path)) await remove(path);
      }),
    );
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
 * scan means nothing is deleted; the next empty trash tries again.
 */
export async function sweepUnusedImages(vaultPath: string): Promise<void> {
  const dir = joinPath(vaultPath, ATTACH_DIR);
  try {
    if (!(await exists(dir))) return;
    const files = (await readDir(dir))
      .filter((e) => e.isFile && e.name)
      .map((e) => e.name);
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

function foldersFromDirs(
  dirs: ScannedDir[],
  ranks: Record<string, number>,
): Folder[] {
  return dirs.map(({ relPath }) => {
    const slashIdx = relPath.lastIndexOf("/");
    const parentId = slashIdx > 0 ? relPath.slice(0, slashIdx) : null;
    const name = slashIdx > 0 ? relPath.slice(slashIdx + 1) : relPath;
    const order = ranks[relPath];
    return {
      id: relPath,
      name,
      parentId,
      createdAt: new Date().toISOString(),
      ...(order === undefined ? {} : { order }),
    };
  });
}

/** The folder ranks on disk. A missing or unreadable file is no order at all. */
async function loadFolderOrder(
  vaultPath: string,
): Promise<Record<string, number>> {
  try {
    const parsed: unknown = JSON.parse(
      await readTextFile(joinPath(vaultPath, FOLDER_ORDER_FILE)),
    );
    if (parsed === null || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, rank]) => typeof rank === "number" && Number.isFinite(rank),
      ),
    );
  } catch {
    return {};
  }
}

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
      await writeTextFile(path, JSON.stringify(ranks, null, 2));
    else if (await exists(path)) await remove(path);
  });
}

/** `withTrash` false skips reading .trash (`trashed` comes back empty): the focus rescan has no use for it. */
export async function loadVault(
  vaultPath: string,
  withTrash = true,
): Promise<{ items: Item[]; folders: Folder[]; trashed: Item[] }> {
  const [{ files, dirs }, trash, ranks] = await Promise.all([
    scanVaultRecursive(vaultPath, vaultPath),
    withTrash ? loadTrash(vaultPath) : Promise.resolve([]),
    loadFolderOrder(vaultPath),
  ]);
  const read = await itemsFromFiles(vaultPath, files);
  // A crash between "write the new note" and "retire the old file" must not show an item twice
  const items = Array.from(new Map(read.map((i) => [i.id, i])).values());
  const liveIds = new Set(items.map((i) => i.id));
  return {
    items,
    folders: foldersFromDirs(dirs, ranks),
    trashed: trash.filter((i) => !liveIds.has(i.id)),
  };
}

export function createFolderDir(
  vaultPath: string,
  folder: Folder,
): Promise<void> {
  return tracked(() =>
    mkdir(folderAbsPath(vaultPath, folder.id), { recursive: true }),
  );
}

export function renameFolderDir(
  vaultPath: string,
  oldId: string,
  newName: string,
): Promise<void> {
  return tracked(async () => {
    const oldAbs = folderAbsPath(vaultPath, oldId);
    const slashIdx = oldId.lastIndexOf("/");
    const newId =
      slashIdx > 0 ? `${oldId.slice(0, slashIdx)}/${newName}` : newName;
    const newAbs = folderAbsPath(vaultPath, newId);
    await rename(oldAbs, newAbs);
  });
}

/** Items are moved out first, so what is left is non-Graphene files: keep them in .trash instead of erasing them. */
export function deleteFolderDir(
  vaultPath: string,
  folderId: string,
): Promise<void> {
  return tracked(async () => {
    const absPath = folderAbsPath(vaultPath, folderId);
    try {
      if (await exists(absPath)) await moveToTrash(vaultPath, absPath);
    } catch (err) {
      console.warn("[storage] deleteFolderDir failed:", absPath, err);
    }
  });
}
