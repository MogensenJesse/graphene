// src/hooks/useItems.ts
import { nanoid } from "nanoid";
import { useCallback, useState } from "react";
import { deleteItemFile, moveItemFile, saveItem } from "../lib/storage";
import type { Item, NoteItem, SnippetItem } from "../types";

export type AddNoteFields = Omit<
  NoteItem,
  "id" | "type" | "createdAt" | "updatedAt"
>;
export type AddSnippetFields = Omit<
  SnippetItem,
  "id" | "type" | "createdAt" | "updatedAt" | "copies"
>;

type UpdateNoteFields = Partial<Omit<NoteItem, "id" | "type" | "createdAt">>;
type UpdateSnippetFields = Partial<
  Omit<SnippetItem, "id" | "type" | "createdAt">
>;
export type UpdateItemFields = UpdateNoteFields | UpdateSnippetFields;

export function useItems(vaultPath: string) {
  const [items, setItems] = useState<Item[]>([]);

  const addNote = useCallback(
    (fields: AddNoteFields): string => {
      const now = new Date().toISOString();
      const note: NoteItem = {
        ...fields,
        id: nanoid(),
        type: "note",
        createdAt: now,
        updatedAt: now,
      };
      setItems((prev) => [note, ...prev]);
      saveItem(vaultPath, note).catch(console.error);
      return note.id;
    },
    [vaultPath],
  );

  const addSnippet = useCallback(
    (fields: AddSnippetFields): string => {
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
      saveItem(vaultPath, snippet).catch(console.error);
      return snippet.id;
    },
    [vaultPath],
  );

  const updateItem = useCallback(
    (id: string, fields: UpdateItemFields) => {
      setItems((prev) => {
        const old = prev.find((i) => i.id === id);
        const next = prev.map((item) =>
          item.id === id
            ? ({
                ...item,
                ...fields,
                updatedAt: new Date().toISOString(),
              } as Item)
            : item,
        );
        const updated = next.find((i) => i.id === id);
        if (updated) {
          // If the title changed the filename changes — delete the stale old file
          if (old && "title" in fields && old.title !== updated.title) {
            deleteItemFile(vaultPath, old).catch(console.error);
          }
          saveItem(vaultPath, updated).catch(console.error);
        }
        return next;
      });
    },
    [vaultPath],
  );

  const deleteItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const target = prev.find((i) => i.id === id);
        if (target) deleteItemFile(vaultPath, target).catch(console.error);
        return prev.filter((item) => item.id !== id);
      });
    },
    [vaultPath],
  );

  const moveItem = useCallback(
    (id: string, newFolderId: string | null) => {
      setItems((prev) => {
        const target = prev.find((i) => i.id === id);
        if (target) {
          moveItemFile(vaultPath, target, newFolderId).catch(console.error);
        }
        return prev.map((item) =>
          item.id === id ? { ...item, folderId: newFolderId } : item,
        );
      });
    },
    [vaultPath],
  );

  const incrementCopyCount = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.map((item) =>
          item.id === id && item.type === "snippet"
            ? { ...item, copies: item.copies + 1 }
            : item,
        );
        const updated = next.find((i) => i.id === id);
        if (updated) saveItem(vaultPath, updated).catch(console.error);
        return next;
      });
    },
    [vaultPath],
  );

  return {
    items,
    setItems,
    addNote,
    addSnippet,
    updateItem,
    deleteItem,
    moveItem,
    incrementCopyCount,
  };
}
