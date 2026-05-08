// src/lib/search.ts
import type { Item } from "../types";

/**
 * Pure filter function — filters items by search query (title + tags + body/code),
 * type, and active folder.
 */
export function filterItems(
  items: Item[],
  query: string,
  typeFilter: "all" | "note" | "snippet" = "all",
  folderId: string | null = null,
): Item[] {
  const q = query.trim().toLowerCase();

  return items.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;

    if (folderId !== null && item.folderId !== folderId) return false;

    if (!q) return true;

    const inTitle = item.title.toLowerCase().includes(q);

    if (item.type === "snippet") {
      const inCode = item.code.toLowerCase().includes(q);
      const inNote = item.note.toLowerCase().includes(q);
      return inTitle || inCode || inNote;
    }

    const inBody = item.body.toLowerCase().includes(q);
    return inTitle || inBody;
  });
}
