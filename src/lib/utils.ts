// src/lib/utils.ts
import type { Folder } from "../types";

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
  return `${Math.floor(diffDays / 30)}mo ago`;
}

/** Returns ordered folder names from root down to `folderId`, e.g. ["Notes", "boop", "ragdollll"] */
export function getFolderPath(folders: Folder[], folderId: string | null): string[] {
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

