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
import {
  CODE_EXTS,
  isLegacySnippetMd,
  legacyToItem,
  parseLegacySnippet,
  parseNoteFile,
  serializeItem,
} from "./fileFormat";
import { getVaultPath, setVaultPath } from "./vault";

// Re-export so callers can import from one place
export { getVaultPath as loadVaultPath, setVaultPath as saveVaultPath };

const TRASH_DIR = ".trash";

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

function joinPath(...parts: string[]): string {
  return parts
    .join("/")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

/** Relative path of a file/dir from vault root, no leading slash */
function relativePath(vaultPath: string, absolutePath: string): string {
  const vaultNorm = vaultPath.replace(/\\/g, "/").replace(/\/$/, "");
  const absNorm = absolutePath.replace(/\\/g, "/");
  if (absNorm.startsWith(`${vaultNorm}/`)) {
    return absNorm.slice(vaultNorm.length + 1);
  }
  return absNorm;
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

export async function scanVaultRecursive(
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

/** Write the converted note first (a crash never loses the snippet), then retire the old file. */
async function convertLegacy(
  vaultPath: string,
  legacyPath: string,
  item: Item,
): Promise<Item> {
  try {
    await saveItem(vaultPath, item);
    // An old JSON-LD .md sits at the very same path and is already replaced; other files keep a backup in .trash
    if (itemFilePath(vaultPath, item) !== legacyPath) {
      await moveToTrash(vaultPath, legacyPath);
    }
  } catch (err) {
    // The item still shows up; the conversion is retried on the next launch
    console.warn("[storage] Failed to convert snippet:", legacyPath, err);
  }
  return item;
}

async function readItemFile(
  vaultPath: string,
  { absPath, name }: ScannedFile,
): Promise<Item | null> {
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx < 0) return null;
  const ext = name.slice(dotIdx).toLowerCase();
  if (ext !== ".md" && !CODE_EXTS.has(ext)) return null;

  const raw = await readTextFile(absPath);
  const folderId = folderIdFromFilePath(vaultPath, absPath);

  if (ext === ".md") {
    const parsed = parseNoteFile(raw);
    if (!parsed.id) return null;
    const itemFolderId = folderId ?? parsed.folderId;
    if (!isLegacySnippetMd(raw)) return { ...parsed, folderId: itemFolderId };
    // Old JSON-LD snippet: the body is the code
    const converted = legacyToItem(
      {
        id: parsed.id,
        title: parsed.title,
        folderId: itemFolderId,
        lang: "JSON-LD",
        note: "",
        code: parsed.body,
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt,
      },
      itemFolderId,
    );
    return convertLegacy(vaultPath, absPath, converted);
  }

  const legacy = parseLegacySnippet(raw, ext);
  if (!legacy) return null;
  const converted = legacyToItem(legacy, folderId ?? legacy.folderId);
  return convertLegacy(vaultPath, absPath, converted);
}

async function itemsFromFiles(
  vaultPath: string,
  files: ScannedFile[],
): Promise<Item[]> {
  const items: Item[] = [];

  // One at a time: conversions rename files and must not race each other
  for (const file of files) {
    try {
      const item = await readItemFile(vaultPath, file);
      if (item) items.push(item);
    } catch (err) {
      console.warn("[storage] Failed to read item file:", file.absPath, err);
    }
  }

  return items;
}

export async function saveItem(vaultPath: string, item: Item): Promise<void> {
  const dir =
    item.folderId !== null ? joinPath(vaultPath, item.folderId) : vaultPath;
  await mkdir(dir, { recursive: true });
  await writeTextFile(itemFilePath(vaultPath, item), serializeItem(item));
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
export async function deleteItemFile(
  vaultPath: string,
  item: Item,
): Promise<void> {
  const filePath = itemFilePath(vaultPath, item);
  try {
    const fileExists = await exists(filePath);
    if (fileExists) await remove(filePath);
  } catch (err) {
    console.warn("[storage] deleteItemFile failed:", filePath, err);
  }
}

export async function moveItemFile(
  vaultPath: string,
  item: Item,
  newFolderId: string | null,
): Promise<void> {
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
    console.warn("[storage] moveItemFile failed:", oldPath, "→", newPath, err);
  }
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

export async function trashItemFile(
  vaultPath: string,
  item: Item,
): Promise<void> {
  const filePath = itemFilePath(vaultPath, item);
  try {
    if (await exists(filePath)) await moveToTrash(vaultPath, filePath);
  } catch (err) {
    console.warn("[storage] trashItemFile failed:", filePath, err);
  }
}

/** Items in <vault>/.trash. Not recursive: converted snippet originals and loose files stay out of sight. */
export async function loadTrash(vaultPath: string): Promise<Item[]> {
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
export async function restoreItemFile(
  vaultPath: string,
  item: Item,
): Promise<Item> {
  const folderExists =
    item.folderId === null ||
    (await exists(folderAbsPath(vaultPath, item.folderId)));
  const restored = folderExists ? item : { ...item, folderId: null };
  await saveItem(vaultPath, restored); // write first, so a crash never loses it
  await remove(trashFilePath(vaultPath, item));
  return restored;
}

/**
 * Delete the listed items from the trash for good. Converted snippet originals and folder leftovers
 * are never listed, so they stay. ponytail: delete the .trash folder by hand once the migration looks right.
 */
export async function emptyTrashFiles(
  vaultPath: string,
  items: Item[],
): Promise<void> {
  await Promise.allSettled(
    items.map(async (item) => {
      const path = trashFilePath(vaultPath, item);
      if (await exists(path)) await remove(path);
    }),
  );
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

function foldersFromDirs(dirs: ScannedDir[]): Folder[] {
  return dirs.map(({ relPath }) => {
    const slashIdx = relPath.lastIndexOf("/");
    const parentId = slashIdx > 0 ? relPath.slice(0, slashIdx) : null;
    const name = slashIdx > 0 ? relPath.slice(slashIdx + 1) : relPath;
    return {
      id: relPath,
      name,
      parentId,
      createdAt: new Date().toISOString(),
    };
  });
}

export async function loadVault(
  vaultPath: string,
): Promise<{ items: Item[]; folders: Folder[]; trashed: Item[] }> {
  const [{ files, dirs }, trash] = await Promise.all([
    scanVaultRecursive(vaultPath, vaultPath),
    loadTrash(vaultPath),
  ]);
  const read = await itemsFromFiles(vaultPath, files);
  // A crash between "write the new note" and "retire the old file" must not show an item twice
  const items = Array.from(new Map(read.map((i) => [i.id, i])).values());
  const liveIds = new Set(items.map((i) => i.id));
  return {
    items,
    folders: foldersFromDirs(dirs),
    trashed: trash.filter((i) => !liveIds.has(i.id)),
  };
}

export async function createFolderDir(
  vaultPath: string,
  folder: Folder,
): Promise<void> {
  const absPath = folderAbsPath(vaultPath, folder.id);
  await mkdir(absPath, { recursive: true });
}

export async function renameFolderDir(
  vaultPath: string,
  oldId: string,
  newName: string,
): Promise<void> {
  const oldAbs = folderAbsPath(vaultPath, oldId);
  const slashIdx = oldId.lastIndexOf("/");
  const newId =
    slashIdx > 0 ? `${oldId.slice(0, slashIdx)}/${newName}` : newName;
  const newAbs = folderAbsPath(vaultPath, newId);
  await rename(oldAbs, newAbs);
}

/** Items are moved out first, so what is left is non-Graphene files: keep them in .trash instead of erasing them. */
export async function deleteFolderDir(
  vaultPath: string,
  folderId: string,
): Promise<void> {
  const absPath = folderAbsPath(vaultPath, folderId);
  try {
    if (await exists(absPath)) await moveToTrash(vaultPath, absPath);
  } catch (err) {
    console.warn("[storage] deleteFolderDir failed:", absPath, err);
  }
}
