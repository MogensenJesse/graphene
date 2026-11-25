// src/hooks/useFolders.ts
import { useCallback } from "react";
import { namesUnder, validateFolderName } from "../lib/folderName";
import {
  type FolderSnapshot,
  isInside,
  movedFolders,
  moveProblem,
  planRestore,
  type RestorePlan,
  snapshotFolder,
} from "../lib/folderOps";
import { reportError } from "../lib/reportError";
import {
  createFolderDir,
  deleteFolderDir,
  moveFolderDir,
  moveItemFile,
  renameFolderDir,
  restoreFolderDir,
  writeFolderOrder,
} from "../lib/storage";
import type { Folder, Item } from "../types";
import { useListRef } from "./useListRef";

const hasRanks = (list: Folder[]) => list.some((f) => f.order !== undefined);

export function useFolders(
  vaultPath: string,
  onDeleteCascade: (folderId: string, newFolderId: string | null) => void,
  // A folder became another path (a rename, or a move under another parent): the notes in it follow
  onRenameFolder?: (oldId: string, newId: string) => void,
  // The Undo of a delete puts these notes back in their folders, with their ranks
  onRestoreNotes?: (moves: RestorePlan["moves"]) => void,
) {
  const [folders, setFolders, foldersRef] = useListRef<Folder>();

  // The folders' order is saved whole from the list, so it follows renames and deletes: call after the list changed
  const saveOrder = useCallback(() => {
    const write = (): Promise<void> =>
      writeFolderOrder(vaultPath, foldersRef.current).catch((err) =>
        reportError("Could not save the order of the folders", err, write),
      );
    write();
  }, [vaultPath, foldersRef]);

  /**
   * Add a root or nested folder. The folder id is the relative path from vault root.
   * parentId is also a relative path (e.g. "Notes") or null for root.
   */
  const addFolder = useCallback(
    (name: string, parentId: string | null = null): string => {
      const newName = name.trim();
      const id = parentId !== null ? `${parentId}/${newName}` : newName;
      // The sidebar field says this in place; it is checked here too, so a bad name never reaches the disk
      const problem = validateFolderName(
        newName,
        namesUnder(foldersRef.current, parentId),
        undefined,
        parentId,
      );
      if (problem) {
        reportError(`Could not create the folder "${newName}". ${problem}`);
        return id;
      }
      const folder: Folder = {
        id,
        name: newName,
        parentId,
        createdAt: new Date().toISOString(),
      };
      const create = (): void => {
        setFolders((prev) => [...prev, folder]);
        createFolderDir(vaultPath, folder).catch((err) => {
          // The folder is not on the disk: take it out of the list too, so the two agree
          setFolders((prev) => prev.filter((f) => f.id !== id));
          reportError(`Could not create the folder "${newName}"`, err, create);
        });
      };
      create();
      return id;
    },
    [vaultPath, setFolders, foldersRef],
  );

  const updateFolder = useCallback(
    (id: string, name: string) => {
      const folder = foldersRef.current.find((f) => f.id === id);
      if (!folder) return;
      const newName = name.trim();
      if (newName === folder.name) return;
      const slashIdx = id.lastIndexOf("/");
      const parentId = slashIdx > 0 ? id.slice(0, slashIdx) : null;
      const newId = parentId !== null ? `${parentId}/${newName}` : newName;
      // Refused before anything changes: a name that is taken (or not allowed) must not reach the list or the disk
      const problem = validateFolderName(
        newName,
        namesUnder(foldersRef.current, parentId),
        folder.name,
        parentId,
      );
      if (problem) {
        reportError(
          `Could not rename the folder "${folder.name}" to "${newName}". ${problem}`,
        );
        return;
      }

      // The directory first: the list follows only a rename that happened, so the two cannot disagree
      const rename = (): Promise<void> =>
        renameFolderDir(vaultPath, id, newName).then(
          () => {
            // The folder itself and every folder under it take the new path
            setFolders((prev) => movedFolders(prev, id, newId));
            if (hasRanks(foldersRef.current)) saveOrder();
            onRenameFolder?.(id, newId);
          },
          (err) =>
            reportError(
              `Could not rename the folder "${folder.name}" to "${newName}"`,
              err,
              rename,
            ),
        );
      rename();
    },
    [vaultPath, onRenameFolder, setFolders, foldersRef, saveOrder],
  );

  /**
   * Deletes a folder: every note under it, at any depth, moves up to its parent, and the folders under it are removed (not moved).
   * Resolves with what the Undo needs (see restoreFolder) once that has happened on the disk, or null when it did not (the
   * failure is reported, and the list follows the disk: a move that failed leaves the folder and its notes where they are).
   */
  const deleteFolder = useCallback(
    async (id: string, items: Item[]): Promise<FolderSnapshot | null> => {
      const snapshot = snapshotFolder(foldersRef.current, items, id);
      if (!snapshot) return null;
      const newParentId = snapshot.parentId;
      try {
        await Promise.all(
          items
            .filter((item) => isInside(item.folderId, id))
            .map((item) => moveItemFile(vaultPath, item, newParentId)),
        );
        const hadRanks = hasRanks(foldersRef.current);
        setFolders((prev) =>
          prev.filter((f) => f.id !== id && !f.id.startsWith(`${id}/`)),
        );
        onDeleteCascade(id, newParentId);
        if (hadRanks) saveOrder();
        // Only after the note files left, so the directory is never renamed under a move in flight
        const trashPath = await deleteFolderDir(vaultPath, id);
        return { ...snapshot, trashPath };
      } catch (err) {
        reportError(
          `Could not delete the folder "${snapshot.folders[0].name}" from the disk`,
          err,
        );
        return null;
      }
    },
    [vaultPath, onDeleteCascade, setFolders, foldersRef, saveOrder],
  );

  /**
   * The Undo of deleteFolder: the folder comes back on the disk (from .trash, with any file Graphene does not know) and in the
   * list with the ranks it had, then each note still where the delete put it goes back to its folder and its rank. `getItems` is
   * the notes as they are now. It refuses, saying why, when it could not be exact (the name is taken, the parent is gone); a
   * failure is reported with a Retry and leaves everything as it is.
   */
  const restoreFolder = useCallback(
    function restore(snapshot: FolderSnapshot, getItems: () => Item[]): void {
      const name = snapshot.folders[0].name;
      const plan = planRestore(snapshot, foldersRef.current, getItems());
      if ("problem" in plan) {
        reportError(
          `Could not bring back the folder "${name}". ${plan.problem}`,
        );
        return;
      }
      restoreFolderDir(
        vaultPath,
        snapshot.folders.map((f) => f.id),
        snapshot.trashPath,
      ).then(
        () => {
          setFolders((prev) => [...prev, ...plan.folders]);
          if (hasRanks(foldersRef.current)) saveOrder();
          onRestoreNotes?.(plan.moves);
        },
        (err) =>
          reportError(`Could not bring back the folder "${name}"`, err, () =>
            restore(snapshot, getItems),
          ),
      );
    },
    [vaultPath, setFolders, foldersRef, saveOrder, onRestoreNotes],
  );

  /**
   * Moves a folder under another parent (null: the vault root): the directory moves with its files, then the list and the notes
   * follow through `onRenameFolder`, which rewrites every note under it (their image links take the new depth: see updateItem).
   * Refused with a message when it would go into itself or a folder inside it, or the name is taken there.
   */
  const moveFolder = useCallback(
    (id: string, newParentId: string | null) => {
      const folder = foldersRef.current.find((f) => f.id === id);
      if (!folder) return;
      const problem = moveProblem(foldersRef.current, id, newParentId);
      if (problem) {
        reportError(`Could not move the folder "${folder.name}". ${problem}`);
        return;
      }
      const newId =
        newParentId === null ? folder.name : `${newParentId}/${folder.name}`;
      const move = (): Promise<void> =>
        moveFolderDir(vaultPath, id, newId).then(
          () => {
            const hadRanks = hasRanks(foldersRef.current);
            setFolders((prev) => movedFolders(prev, id, newId));
            // The moved folder loses its rank, so the file is written even when it was the only one
            if (hadRanks || hasRanks(foldersRef.current)) saveOrder();
            onRenameFolder?.(id, newId);
          },
          (err) =>
            reportError(
              `Could not move the folder "${folder.name}"`,
              err,
              move,
            ),
        );
      move();
    },
    [vaultPath, onRenameFolder, setFolders, foldersRef, saveOrder],
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
    restoreFolder,
    moveFolder,
    reorderFolders,
  };
}
