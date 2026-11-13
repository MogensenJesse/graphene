// src/lib/utils.ts
import type { Folder, Item } from "../types";

/** A code item is a note that starts with a fenced block; it gets the code icon and the "code" filter. */
export function isCodeItem(item: Item): boolean {
  return /^\s*```/.test(item.body);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "today";
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

const COLLAPSED_KEY = "graphene.collapsed";

/** Folder ids the user collapsed. localStorage can be missing or corrupt, so fall back to "none". */
export function readCollapsed(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(COLLAPSED_KEY) ?? "[]",
    );
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export function setFolderCollapsed(id: string, collapsed: boolean): void {
  try {
    const set = readCollapsed();
    if (collapsed) set.add(id);
    else set.delete(id);
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set]));
  } catch {
    // Persistence is a convenience; the tree still works without it
  }
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

export interface FlatFolder {
  folder: Folder;
  depth: number;
}

/** Every folder, depth-first with siblings in name order, each with its nesting depth. */
export function flattenFolders(
  folders: Folder[],
  parentId: string | null = null,
  depth = 0,
): FlatFolder[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => compareNames(a.name, b.name))
    .flatMap((f) => [
      { folder: f, depth },
      ...flattenFolders(folders, f.id, depth + 1),
    ]);
}
