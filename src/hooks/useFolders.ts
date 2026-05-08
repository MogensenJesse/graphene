// src/hooks/useFolders.ts
import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";
import { loadFolders, saveFolders } from "../lib/storage";
import type { Folder } from "../types";
import { useDebouncedPersist } from "./useDebouncedPersist";

export function useFolders(
  onDeleteCascade: (folderId: string, newFolderId: string | null) => void,
) {
  const [folders, setFolders] = useState<Folder[]>([]);

  useEffect(() => {
    loadFolders().then(setFolders).catch(console.error);
  }, []);

  useDebouncedPersist(folders, saveFolders);

  const addFolder = useCallback(
    (name: string, parentId: string | null = null): string => {
      const folder: Folder = {
        id: nanoid(),
        name: name.trim(),
        parentId,
        createdAt: new Date().toISOString(),
      };
      setFolders((prev) => [...prev, folder]);
      return folder.id;
    },
    [],
  );

  const updateFolder = useCallback((id: string, name: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)),
    );
  }, []);

  const deleteFolder = useCallback(
    (id: string) => {
      setFolders((prev) => {
        const target = prev.find((f) => f.id === id);
        const newParentId = target?.parentId ?? null;

        const updated = prev
          .filter((f) => f.id !== id)
          .map((f) =>
            f.parentId === id ? { ...f, parentId: newParentId } : f,
          );

        onDeleteCascade(id, newParentId);

        return updated;
      });
    },
    [onDeleteCascade],
  );

  return { folders, addFolder, updateFolder, deleteFolder };
}
