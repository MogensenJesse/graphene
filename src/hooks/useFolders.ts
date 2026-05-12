// src/hooks/useFolders.ts
import { useCallback, useState } from "react";
import {
  createFolderDir,
  deleteFolderDir,
  moveItemFile,
  renameFolderDir,
} from "../lib/storage";
import type { Folder, Item } from "../types";

export function useFolders(
  vaultPath: string,
  onDeleteCascade: (folderId: string, newFolderId: string | null) => void,
) {
  const [folders, setFolders] = useState<Folder[]>([]);

  /**
   * Add a root or nested folder. The folder id is the relative path from vault root.
   * parentId is also a relative path (e.g. "Notes") or null for root.
   */
  const addFolder = useCallback(
    (name: string, parentId: string | null = null): string => {
      const id = parentId !== null ? `${parentId}/${name.trim()}` : name.trim();
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
    [vaultPath],
  );

  const updateFolder = useCallback(
    (id: string, name: string) => {
      const newName = name.trim();
      setFolders((prev) => {
        const target = prev.find((f) => f.id === id);
        if (!target) return prev;

        const slashIdx = id.lastIndexOf("/");
        const newId =
          slashIdx > 0 ? `${id.slice(0, slashIdx)}/${newName}` : newName;

        // Update the folder itself and any descendants whose id starts with old id
        const updated = prev.map((f) => {
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
        });

        renameFolderDir(vaultPath, id, newName).catch(console.error);
        return updated;
      });
    },
    [vaultPath],
  );

  const deleteFolder = useCallback(
    (id: string, items: Item[]) => {
      setFolders((prev) => {
        const target = prev.find((f) => f.id === id);
        const newParentId = target?.parentId ?? null;

        // Move items in the deleted folder to parent
        for (const item of items) {
          if (item.folderId === id || item.folderId?.startsWith(`${id}/`)) {
            moveItemFile(vaultPath, item, newParentId).catch(console.error);
          }
        }

        const updated = prev
          .filter((f) => f.id !== id && !f.id.startsWith(`${id}/`))
          .map((f) =>
            f.parentId === id ? { ...f, parentId: newParentId } : f,
          );

        onDeleteCascade(id, newParentId);
        deleteFolderDir(vaultPath, id).catch(console.error);
        return updated;
      });
    },
    [vaultPath, onDeleteCascade],
  );

  return { folders, setFolders, addFolder, updateFolder, deleteFolder };
}
