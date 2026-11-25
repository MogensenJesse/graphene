// src/lib/folderName.ts
// What a folder may be called. A folder is a real directory, so the name must work on Windows, and the
// scan skips dot folders (the folder and its notes would vanish on the next rescan).
import type { Folder } from "../types";
import { isReservedFolderName } from "./attachments";

const BAD_CHARS = /[\\/:*?"<>|]/;
// Windows also refuses these with an extension ("con.txt")
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** The names of the folders that share `parentId` (null: the vault root). */
export const namesUnder = (folders: Folder[], parentId: string | null) =>
  folders.filter((f) => f.parentId === parentId).map((f) => f.name);

/**
 * Why `name` cannot be used for a folder under `parentId`, in plain language, or null when it can.
 * When a folder is renamed, `siblings` includes its own name (`ownCurrentName`): a new casing of that
 * name is fine, taking another folder's name is not.
 */
export function validateFolderName(
  name: string,
  siblings: string[],
  ownCurrentName?: string,
  parentId: string | null = null,
): string | null {
  if (name.trim() === "") return "Type a name for the folder.";
  if (BAD_CHARS.test(name))
    return 'A folder name cannot contain / \\ : * ? " < > |';
  if (name === "." || name === "..")
    return 'A folder cannot be named "." or "..".';
  if (name.startsWith("."))
    return "A name that starts with a dot hides the folder and its notes. Start with another character.";
  if (name.endsWith(".") || name.endsWith(" "))
    return "A folder name cannot end with a dot or a space.";
  if (WINDOWS_RESERVED.test(name.split(".")[0].trimEnd()))
    return `"${name}" is a reserved name on Windows. Pick another one.`;
  if (isReservedFolderName(name, parentId))
    return `"${name.trim()}" is where Graphene keeps pasted pictures. Pick another name.`;
  const lower = name.toLowerCase();
  if (siblings.some((s) => s !== ownCurrentName && s.toLowerCase() === lower))
    return `A folder named "${name}" already exists here.`;
  return null;
}
