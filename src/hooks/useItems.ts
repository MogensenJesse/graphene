// src/hooks/useItems.ts
import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";
import { loadItems, saveItems } from "../lib/storage";
import type { Item, NoteItem, SnippetItem } from "../types";
import { useDebouncedPersist } from "./useDebouncedPersist";

type AddNoteFields = Omit<NoteItem, "id" | "type" | "createdAt" | "updatedAt">;
type AddSnippetFields = Omit<
  SnippetItem,
  "id" | "type" | "createdAt" | "updatedAt" | "copies"
>;

type UpdateNoteFields = Partial<Omit<NoteItem, "id" | "type" | "createdAt">>;
type UpdateSnippetFields = Partial<Omit<SnippetItem, "id" | "type" | "createdAt">>;
export type UpdateItemFields = UpdateNoteFields | UpdateSnippetFields;

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useDebouncedPersist(items, saveItems);

  const addNote = useCallback((fields: AddNoteFields): string => {
    const now = new Date().toISOString();
    const note: NoteItem = {
      ...fields,
      id: nanoid(),
      type: "note",
      createdAt: now,
      updatedAt: now,
    };
    setItems((prev) => [note, ...prev]);
    return note.id;
  }, []);

  const addSnippet = useCallback((fields: AddSnippetFields): string => {
    const now = new Date().toISOString();
    const snippet: SnippetItem = {
      ...fields,
      id: nanoid(),
      type: "snippet",
      createdAt: now,
      updatedAt: now,
      copies: 0,
    };
    setItems((prev) => [snippet, ...prev]);
    return snippet.id;
  }, []);

  const updateItem = useCallback((id: string, fields: UpdateItemFields) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? ({ ...item, ...fields, updatedAt: new Date().toISOString() } as Item)
          : item,
      ),
    );
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const incrementCopyCount = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.type === "snippet"
          ? { ...item, copies: item.copies + 1 }
          : item,
      ),
    );
  }, []);

  return {
    items,
    loading,
    addNote,
    addSnippet,
    updateItem,
    deleteItem,
    incrementCopyCount,
  };
}
