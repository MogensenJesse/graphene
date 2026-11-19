// src/lib/itemPaths.ts
// Where a note lives on disk. Pure (no fs), so the app (lib/storage) and the MCP server (mcp/) name files the same way.
import type { Item } from "../types";
import { joinPath } from "./paths";

/** Sanitize a title into a safe, readable filename segment (max 50 chars). */
export function slugify(title: string): string {
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

/** Build absolute path for a folder id (which is a relative path from vault) */
export function folderAbsPath(vaultPath: string, folderId: string): string {
  return joinPath(vaultPath, folderId);
}

export function itemFileName(item: Item): string {
  return `${slugify(item.title)}-${item.id}.md`;
}

/** Determine absolute path for an item file */
export function itemFilePath(vaultPath: string, item: Item): string {
  const dir =
    item.folderId !== null ? joinPath(vaultPath, item.folderId) : vaultPath;
  return joinPath(dir, itemFileName(item));
}
