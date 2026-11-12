// src/hooks/useItems.ts
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyTrashFiles,
  moveItemFile,
  replaceItemFile,
  restoreItemFile,
  saveItem,
  trashItemFile,
} from "../lib/storage";
import type { Item } from "../types";

export type AddItemFields = Pick<Item, "title" | "body" | "folderId">;
export type UpdateItemFields = Partial<Omit<Item, "id" | "createdAt">>;

export function useItems(vaultPath: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [trashed, setTrashed] = useState<Item[]>([]);

  // Latest lists for callbacks that must read them outside a state updater
  const itemsRef = useRef(items);
  const trashedRef = useRef(trashed);
  useEffect(() => {
    itemsRef.current = items;
    trashedRef.current = trashed;
  });

  const addItem = useCallback(
    (fields: AddItemFields): string => {
      const now = new Date().toISOString();
      const item: Item = {
        ...fields,
        id: nanoid(),
        createdAt: now,
        updatedAt: now,
      };
      setItems((prev) => [item, ...prev]);
      saveItem(vaultPath, item).catch(console.error);
      return item.id;
    },
    [vaultPath],
  );

  const updateItem = useCallback(
    // touch=false keeps updatedAt (folder renames/deletes must not make every item look edited)
    (id: string, fields: UpdateItemFields, touch = true) => {
      setItems((prev) => {
        const old = prev.find((i) => i.id === id);
        const next = prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...fields,
                updatedAt: touch ? new Date().toISOString() : item.updatedAt,
              }
            : item,
        );
        const updated = next.find((i) => i.id === id);
        if (updated) {
          // Title or folder changes move the file — replaceItemFile drops the stale one
          (old
            ? replaceItemFile(vaultPath, old, updated)
            : saveItem(vaultPath, updated)
          ).catch(console.error);
        }
        return next;
      });
    },
    [vaultPath],
  );

  // Soft delete: the file moves to <vault>/.trash and the item shows up in the Trash view
  const deleteItem = useCallback(
    (id: string) => {
      const target = itemsRef.current.find((i) => i.id === id);
      if (!target) return;
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTrashed((prev) => [target, ...prev]);
      trashItemFile(vaultPath, target).catch(console.error);
    },
    [vaultPath],
  );

  const restoreItem = useCallback(
    async (id: string) => {
      const target = trashedRef.current.find((i) => i.id === id);
      if (!target) return;
      try {
        const restored = await restoreItemFile(vaultPath, target);
        setTrashed((prev) => prev.filter((item) => item.id !== id));
        setItems((prev) => [restored, ...prev]);
      } catch (err) {
        console.error("[useItems] restore failed:", err);
      }
    },
    [vaultPath],
  );

  const emptyTrash = useCallback(() => {
    const gone = trashedRef.current;
    setTrashed([]);
    emptyTrashFiles(vaultPath, gone).catch(console.error);
  }, [vaultPath]);

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

  return {
    items,
    setItems,
    trashed,
    setTrashed,
    itemsRef,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    restoreItem,
    emptyTrash,
  };
}
