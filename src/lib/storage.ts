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
import type { Folder, Item, NoteItem, SnippetItem } from "../types";
import {
  extForLang,
  langFromExt,
  parseNoteFile,
  parseSnippetFile,
  serializeNote,
  serializeSnippet,
} from "./fileFormat";
import { getVaultPath, setVaultPath } from "./vault";

// Re-export so callers can import from one place
export { getVaultPath as loadVaultPath, setVaultPath as saveVaultPath };

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
function folderAbsPath(vaultPath: string, folderId: string): string {
  return joinPath(vaultPath, folderId);
}

/** Determine absolute path for an item file */
function itemFilePath(vaultPath: string, item: Item): string {
  const ext =
    item.type === "note" ? ".md" : extForLang((item as SnippetItem).lang);
  const dir =
    item.folderId !== null
      ? joinPath(vaultPath, item.folderId)
      : vaultPath;
  return joinPath(dir, `${slugify(item.title)}-${item.id}${ext}`);
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

export async function loadAllItems(vaultPath: string): Promise<Item[]> {
  const items: Item[] = [];
  const { files } = await scanVaultRecursive(vaultPath, vaultPath);

  for (const { absPath, name } of files) {
    const dotIdx = name.lastIndexOf(".");
    if (dotIdx < 0) continue;
    const ext = name.slice(dotIdx).toLowerCase();

    try {
      const raw = await readTextFile(absPath);
      const folderId = folderIdFromFilePath(vaultPath, absPath);

      if (ext === ".md") {
        // Could be a note OR a JSON-LD snippet stored as .md
        const parsed = parseNoteFile(raw);
        if (!parsed.id) continue;

        // Check if this is a JSON-LD snippet stored as .md
        // (frontmatter has type: snippet or lang: JSON-LD)
        const rawLower = raw.slice(0, 200);
        if (
          rawLower.includes("type: snippet") ||
          rawLower.includes('type: "snippet"')
        ) {
          // Parse as snippet via the note format path
          const note = parseNoteFile(raw);
          if (!note.id) continue;
          // The body is the JSON-LD code
          const snippet: SnippetItem = {
            id: note.id,
            type: "snippet",
            title: note.title,
            folderId: folderId ?? note.folderId,
            lang: "JSON-LD",
            code: note.body,
            note: "",
            copies: 0,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
          };
          items.push(snippet);
        } else {
          const note: NoteItem = {
            ...parsed,
            folderId: folderId ?? parsed.folderId,
          };
          items.push(note);
        }
      } else {
        const lang = langFromExt(ext);
        if (!lang) continue;
        const snippet = parseSnippetFile(raw, ext);
        if (!snippet.id) continue;
        items.push({ ...snippet, folderId: folderId ?? snippet.folderId });
      }
    } catch (err) {
      console.warn("[storage] Failed to read item file:", absPath, err);
    }
  }

  return items;
}

export async function saveItem(
  vaultPath: string,
  item: Item,
): Promise<void> {
  const dir =
    item.folderId !== null
      ? joinPath(vaultPath, item.folderId)
      : vaultPath;
  await mkdir(dir, { recursive: true });

  const filePath = itemFilePath(vaultPath, item);
  const content =
    item.type === "note"
      ? serializeNote(item as NoteItem)
      : serializeSnippet(item as SnippetItem);

  await writeTextFile(filePath, content);
}

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

  const ext =
    item.type === "note" ? ".md" : extForLang((item as SnippetItem).lang);
  const newPath = joinPath(newDir, `${slugify(item.title)}-${item.id}${ext}`);

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
// Folders
// ---------------------------------------------------------------------------

export async function loadAllFolders(vaultPath: string): Promise<Folder[]> {
  const { dirs } = await scanVaultRecursive(vaultPath, vaultPath);
  return dirs.map(({ relPath }) => {
    const slashIdx = relPath.lastIndexOf("/");
    const parentId = slashIdx > 0 ? relPath.slice(0, slashIdx) : null;
    const name =
      slashIdx > 0 ? relPath.slice(slashIdx + 1) : relPath;
    return {
      id: relPath,
      name,
      parentId,
      createdAt: new Date().toISOString(),
    };
  });
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

export async function deleteFolderDir(
  vaultPath: string,
  folderId: string,
): Promise<void> {
  const absPath = folderAbsPath(vaultPath, folderId);
  try {
    const dirExists = await exists(absPath);
    if (dirExists) await remove(absPath, { recursive: true });
  } catch (err) {
    console.warn("[storage] deleteFolderDir failed:", absPath, err);
  }
}
