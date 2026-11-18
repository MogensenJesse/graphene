// src/hooks/useItems.ts
import { nanoid } from "nanoid";
import { useCallback } from "react";
import { relinkAttachments } from "../lib/attachments";
import {
  emptyTrashFiles,
  moveItemFile,
  replaceItemFile,
  restoreItemFile,
  saveItem,
  sweepUnusedImages,
  trashItemFile,
} from "../lib/storage";
import type { Item } from "../types";
import { useListRef } from "./useListRef";

export type AddItemFields = Pick<Item, "title" | "body" | "folderId">;
export type UpdateItemFields = Partial<Omit<Item, "id" | "createdAt">>;

export function useItems(vaultPath: string) {
  const [items, setItems, itemsRef] = useListRef<Item>();
  const [trashed, setTrashed, trashedRef] = useListRef<Item>();

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
    [vaultPath, setItems],
  );

  const updateItem = useCallback(
    // touch=false keeps updatedAt (folder renames/deletes must not make every item look edited)
    (id: string, fields: UpdateItemFields, touch = true) => {
      const old = itemsRef.current.find((i) => i.id === id);
      if (!old) return;
      const merged = {
        ...old,
        ...fields,
        updatedAt: touch ? new Date().toISOString() : old.updatedAt,
      };
      // In another folder it has no place in that folder's order yet, unless the caller says what its rank is
      if (merged.folderId !== old.folderId && !("order" in fields))
        merged.order = undefined;
      // Moving to a folder of another depth changes how its image links reach the vault root
      const updated = {
        ...merged,
        body: relinkAttachments(merged.body, old.folderId, merged.folderId),
      };
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      // Title or folder changes move the file — replaceItemFile drops the stale one
      replaceItemFile(vaultPath, old, updated).catch(console.error);
    },
    [vaultPath, setItems, itemsRef],
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
    [vaultPath, setItems, setTrashed, itemsRef],
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
    [vaultPath, setItems, setTrashed, trashedRef],
  );

  const emptyTrash = useCallback(() => {
    const gone = trashedRef.current;
    setTrashed([]);
    // The notes that used pictures are gone now, so look for pictures nothing links to
    emptyTrashFiles(vaultPath, gone)
      .then(() => sweepUnusedImages(vaultPath))
      .catch(console.error);
  }, [vaultPath, setTrashed, trashedRef]);

  const moveItem = useCallback(
    (id: string, newFolderId: string | null) => {
      const target = itemsRef.current.find((i) => i.id === id);
      if (!target || target.folderId === newFolderId) return;
      const body = relinkAttachments(target.body, target.folderId, newFolderId);
      // Last in its new folder: its rank belonged to the old one
      const moved = {
        ...target,
        folderId: newFolderId,
        body,
        order: undefined,
      };
      setItems((prev) => prev.map((i) => (i.id === id ? moved : i)));
      // A plain rename of the file; a note whose image links change or that had a rank is rewritten
      (body === target.body && target.order === undefined
        ? moveItemFile(vaultPath, target, newFolderId)
        : replaceItemFile(vaultPath, target, moved)
      ).catch(console.error);
    },
    [vaultPath, setItems, itemsRef],
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
