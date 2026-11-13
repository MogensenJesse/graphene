// src/lib/search.ts
import type { Item } from "../types";
import { isCodeItem } from "./utils";

/**
 * Pure filter function — filters items by search query (title + body) and type.
 * Folder grouping is handled visually by the folder tree.
 */
export function filterItems(
  items: Item[],
  query: string,
  typeFilter: "all" | "note" | "code" = "all",
): Item[] {
  const q = query.trim().toLowerCase();

  return items.filter((item) => {
    if (typeFilter !== "all" && isCodeItem(item) !== (typeFilter === "code")) {
      return false;
    }

    if (!q) return true;

    return (
      item.title.toLowerCase().includes(q) ||
      item.body.toLowerCase().includes(q)
    );
  });
}
