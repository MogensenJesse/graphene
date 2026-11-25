// src/hooks/useRowItems.ts
import { useRef } from "react";
import { rowItems } from "../lib/rowItems";
import type { Item } from "../types";

/** The notes for the sidebar's rows: `items`, but the same array and objects while nothing a row shows has changed (see lib/rowItems). */
export function useRowItems(items: Item[]): Item[] {
  const last = useRef<Item[]>([]);
  const rows = rowItems(last.current, items);
  last.current = rows;
  return rows;
}
