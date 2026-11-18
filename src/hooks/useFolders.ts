// src/hooks/useFolders.ts
import { useCallback } from "react";
import { isReservedFolderName } from "../lib/attachments";
import {
  createFolderDir,
  deleteFolderDir,
  moveItemFile,
  renameFolderDir,
  writeFolderOrder,
} from "../lib/storage";
import type { Folder, Item } from "../types";
import { useListRef } from "./useListRef";

const hasRanks = (list: Folder[]) => list.some((f) => f.order !== undefined);

export function useFolders(
  vaultPath: string,
  onDeleteCascade: (folderId: string, newFolderId: string | null) => void,
  onRenameFolder?: (oldId: string, newId: string) => void,
) {
  const [folders, setFolders, foldersRef] = useListRef<Folder>();

  // The folders' order is saved whole from the list, so it follows renames and deletes: call after the list changed
  const saveOrder = useCallback(
    () => writeFolderOrder(vaultPath, foldersRef.current).catch(console.error),
    [vaultPath, foldersRef],
  );

  /**
   * Add a root or nested folder. The folder id is the relative path from vault root.
   * parentId is also a relative path (e.g. "Notes") or null for root.
   */
  const addFolder = useCallback(
    (name: string, parentId: string | null = null): string => {
      const id = parentId !== null ? `${parentId}/${name.trim()}` : name.trim();
      // ponytail: refused without a message; the name is the images folder
      if (isReservedFolderName(name, parentId)) return id;
      const folder: Folder = {
        id,
        name: name.trim(),
        parentId,
        createdAt: new Date().toISOString(),
      };
      setFolders((prev) => [...prev, folder]);
      createFolderDir(vaultPath, folder).catch(console.error);
      return id;
    },
    [vaultPath, setFolders],
  );

  const updateFolder = useCallback(
    (id: string, name: string) => {
      const newName = name.trim();
      const slashIdx = id.lastIndexOf("/");
      const newId =
        slashIdx > 0 ? `${id.slice(0, slashIdx)}/${newName}` : newName;
      if (
        isReservedFolderName(
          newName,
          slashIdx > 0 ? id.slice(0, slashIdx) : null,
        )
      )
        return;
      if (!foldersRef.current.some((f) => f.id === id)) return;

      // Update the folder itself and any descendants whose id starts with old id
      setFolders((prev) =>
        prev.map((f) => {
          if (f.id === id) {
            return { ...f, id: newId, name: newName };
          }
          if (f.id.startsWith(`${id}/`)) {
            const newChildId = newId + f.id.slice(id.length);
            const newParentId =
              f.parentId === id
                ? newId
                : f.parentId?.startsWith(`${id}/`)
                  ? newId + f.parentId.slice(id.length)
                  : f.parentId;
            return { ...f, id: newChildId, parentId: newParentId ?? null };
          }
          if (f.parentId === id) {
            return { ...f, parentId: newId };
          }
          return f;
        }),
      );

      renameFolderDir(vaultPath, id, newName).catch(console.error);
      if (hasRanks(foldersRef.current)) saveOrder();
      onRenameFolder?.(id, newId);
    },
    [vaultPath, onRenameFolder, setFolders, foldersRef, saveOrder],
  );

  const deleteFolder = useCallback(
    (id: string, items: Item[]) => {
      const newParentId =
        foldersRef.current.find((f) => f.id === id)?.parentId ?? null;
      const hadRanks = hasRanks(foldersRef.current);

      // Move items in the deleted folder to parent
      const moves = items
        .filter(
          (item) => item.folderId === id || item.folderId?.startsWith(`${id}/`),
        )
        .map((item) => moveItemFile(vaultPath, item, newParentId));

      setFolders((prev) =>
        prev
          .filter((f) => f.id !== id && !f.id.startsWith(`${id}/`))
          .map((f) =>
            f.parentId === id ? { ...f, parentId: newParentId } : f,
          ),
      );
      onDeleteCascade(id, newParentId);
      if (hadRanks) saveOrder();
      // Only after the item files left, so the directory is never renamed under a move in flight
      Promise.all(moves)
        .then(() => deleteFolderDir(vaultPath, id))
        .catch(console.error);
    },
    [vaultPath, onDeleteCascade, setFolders, foldersRef, saveOrder],
  );

  /** Gives folders their rank in the order (see lib/order placeNear); the file follows. */
  const reorderFolders = useCallback(
    (ranks: Record<string, number>) => {
      setFolders((prev) =>
        prev.map((f) => (f.id in ranks ? { ...f, order: ranks[f.id] } : f)),
      );
      saveOrder();
    },
    [setFolders, saveOrder],
  );

  return {
    folders,
    setFolders,
    addFolder,
    updateFolder,
    deleteFolder,
    reorderFolders,
  };
}
