// mcp/tools.ts
// What the MCP server can do with a vault. Plain async functions, so the tests (and anything else) can call them without
// the protocol. Note format, kinds and search all come from the app's own pure modules in src/lib.
import { nanoid } from "nanoid";
import { isReservedFolderName } from "../src/lib/attachments";
import { itemFilePath } from "../src/lib/itemPaths";
import { joinPath } from "../src/lib/paths";
import { searchItems } from "../src/lib/search";
import { compareNames, itemKind } from "../src/lib/utils";
import type { Item } from "../src/types";
import { type Note, scanVault, writeNote } from "./vault";

const summary = (item: Item) => ({
  id: item.id,
  title: item.title || "Untitled",
  folder: item.folderId,
  kind: itemKind(item),
  updated: item.updatedAt,
});

async function findNote(vault: string, id: string): Promise<Note> {
  const note = (await scanVault(vault)).notes.find((n) => n.item.id === id);
  if (!note)
    throw new Error(`No note with id "${id}". Use search_notes to find one.`);
  return note;
}

/**
 * A folder path the model gave, checked: names joined by "/", nothing absolute, no dot names (so no ".."), no
 * characters Windows refuses, and not the vault's attachments folder. ponytail: Windows' reserved names (CON, NUL) pass.
 */
export function folderPath(input: string | undefined): string | null {
  const path = joinPath(input ?? "");
  if (!path) return null;
  const segments = path.split("/");
  const bad = segments.some(
    (s) =>
      !s.trim() ||
      s.startsWith(".") ||
      s.endsWith(" ") ||
      // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what this rejects
      /[<>:"|?*\u0000-\u001f]/.test(s),
  );
  if (bad || isReservedFolderName(segments[0], null))
    throw new Error(
      `"${input}" is not a usable folder path. Use folder names separated by "/", like "Prompts/Agents".`,
    );
  return path;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function listFolders(vault: string) {
  const { notes, folders } = await scanVault(vault);
  const count = (path: string | null) =>
    notes.filter((n) => n.item.folderId === path).length;
  return {
    notesWithoutFolder: count(null),
    folders: folders
      .sort(compareNames)
      .map((path) => ({ path, notes: count(path) })),
  };
}

export async function searchNotes(
  vault: string,
  { query = "", limit = 20 }: { query?: string; limit?: number },
) {
  const { notes } = await scanVault(vault);
  return searchItems(
    notes.map((n) => n.item),
    query,
    limit,
  ).map(({ item, snippet }) => ({
    ...summary(item),
    ...(snippet
      ? { snippet: snippet.before + snippet.match + snippet.after }
      : {}),
  }));
}

export async function readNote(vault: string, { id }: { id: string }) {
  const { item } = await findNote(vault, id);
  return {
    ...summary(item),
    created: item.createdAt,
    body: item.body,
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function createNote(
  vault: string,
  {
    title,
    body = "",
    folder,
  }: { title: string; body?: string; folder?: string },
) {
  const now = new Date().toISOString();
  const item: Item = {
    id: nanoid(),
    // The frontmatter is one line per field, so a title is one line too
    title: title.replace(/\s*[\r\n]+\s*/g, " ").trim(),
    folderId: folderPath(folder),
    body,
    createdAt: now,
    updatedAt: now,
  };
  if (!item.title) throw new Error("A note needs a title.");
  await writeNote(itemFilePath(vault, item), item);
  return summary(item);
}

export async function appendToNote(
  vault: string,
  { id, text }: { id: string; text: string },
) {
  const { item, path } = await findNote(vault, id);
  const gap = item.body === "" || item.body.endsWith("\n") ? "" : "\n";
  const updated = {
    ...item,
    body: item.body + gap + text,
    updatedAt: new Date().toISOString(),
  };
  await writeNote(path, updated);
  return { id, title: item.title, updated: updated.updatedAt };
}

/** Replaces text inside a note. Fails rather than guesses when the text is missing or could be in several places. */
export async function editNote(
  vault: string,
  {
    id,
    old_text,
    new_text,
    replace_all = false,
  }: { id: string; old_text: string; new_text: string; replace_all?: boolean },
) {
  const { item, path } = await findNote(vault, id);
  // Notes are read with "\n" line ends (parseNoteFile), so text a model copied with "\r\n" has to match too
  const find = old_text.replace(/\r\n/g, "\n");
  if (!find)
    throw new Error(
      "old_text must not be empty. To add text at the end of a note, use append_to_note.",
    );
  const parts = item.body.split(find);
  const found = parts.length - 1;
  if (found === 0)
    throw new Error(
      "old_text was not found in the note. Use read_note and copy the text exactly.",
    );
  if (found > 1 && !replace_all)
    throw new Error(
      `old_text appears ${found} times. Include more of the text around it to make it unique, or set replace_all.`,
    );
  // split/join, not String.replace, so a "$&" in new_text stays as typed
  const body = parts.join(new_text.replace(/\r\n/g, "\n"));
  const changed = body !== item.body;
  const updatedAt = changed ? new Date().toISOString() : item.updatedAt;
  if (changed) await writeNote(path, { ...item, body, updatedAt });
  return { id, title: item.title, replaced: found, updated: updatedAt };
}
