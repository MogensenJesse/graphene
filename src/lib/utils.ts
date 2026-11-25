// src/lib/utils.ts
import type { Folder, Item, ItemKind } from "../types";

/** A code body starts with a fenced block; its note gets the code icon, the "code" filter and a line count. */
export function isCodeBody(body: string): boolean {
  return /^\s*```/.test(body);
}

export function itemKind(item: Item): ItemKind {
  // A note whose text has not been read yet has the kind the scan saw in it
  if (item.unloaded) return item.unloaded.kind;
  return isCodeBody(item.body) ? "code" : "note";
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
