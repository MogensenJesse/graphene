// src/lib/utils.ts
import type { Folder, Item, ItemKind } from "../types";
import { isTodoBody } from "./tasks";

/** A code body starts with a fenced block; its note gets the code icon, the "code" filter and a line count. */
export function isCodeBody(body: string): boolean {
  return /^\s*```/.test(body);
}

function isCodeItem(item: Item): boolean {
  return isCodeBody(item.body);
}

/** A to-do is a note that starts with a task (after any headings); a code item is never one. */
export function isTodoItem(item: Item): boolean {
  return !isCodeItem(item) && isTodoBody(item.body);
}

export function itemKind(item: Item): ItemKind {
  return isCodeItem(item) ? "code" : isTodoItem(item) ? "todo" : "note";
}

const FENCE_LINE = /^\s*(```|~~~)/;

/** Words in a note body: tokens with a letter or digit. Fence lines, list and task markers and bare "---" are syntax. */
export function wordCount(body: string): number {
  const text = body
    .split(/\r?\n/)
    .filter((line) => !FENCE_LINE.test(line))
    .join("\n")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\](?=\s))?/gm, "");
  return (text.match(/\S+/g) ?? []).filter((t) => /[\p{L}\p{N}]/u.test(t))
    .length;
}

/** Lines of a code note's text, not counting the fences or blank lines. */
export function lineCount(body: string): number {
  return body
    .split(/\r?\n/)
    .filter((line) => line.trim() && !FENCE_LINE.test(line)).length;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  // Calendar days, so an edit at 23:00 says "1d ago" the next morning instead of "today"
  const day = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round((day(now) - day(d)) / 86400000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 14) return "1w ago";
  if (diffDays < 28) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 60) return "1mo ago";
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

const nameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/** Natural-order name comparison ("note 2" before "note 10"), ignoring case. */
export function compareNames(a: string, b: string): number {
  return nameCollator.compare(a, b);
}

/** Returns ordered folder names from root down to `folderId`, e.g. ["Notes", "boop", "ragdollll"] */
export function getFolderPath(
  folders: Folder[],
  folderId: string | null,
): string[] {
  if (!folderId) return [];
  const result: string[] = [];
  let currentId: string | null = folderId;
  while (currentId) {
    const folder = folders.find((f) => f.id === currentId);
    if (!folder) break;
    result.unshift(folder.name);
    currentId = folder.parentId;
  }
  return result;
}

interface FlatFolder {
  folder: Folder;
  depth: number;
}

/** Every folder, depth-first with siblings sorted by `compare`, each with its nesting depth. */
export function flattenFolders(
  folders: Folder[],
  compare: (a: Folder, b: Folder) => number,
  parentId: string | null = null,
  depth = 0,
): FlatFolder[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort(compare)
    .flatMap((f) => [
      { folder: f, depth },
      ...flattenFolders(folders, compare, f.id, depth + 1),
    ]);
}
