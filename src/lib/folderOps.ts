// src/lib/folderOps.ts
// The pure parts of the folder operations that reach into notes: deleting a folder and bringing it back (Undo), and moving a
// folder under another one. The disk work is in storage.ts, the state in hooks/useFolders.ts.
import type { Folder, Item } from "../types";
import { namesUnder, validateFolderName } from "./folderName";

/** The note facts a folder operation needs. */
type NoteAt = Pick<Item, "id" | "folderId" | "order">;

/** Whether a folder path is the folder `id` or sits under it. */
export const isInside = (folderId: string | null, id: string): boolean =>
  folderId !== null && (folderId === id || folderId.startsWith(`${id}/`));

/**
 * A deleted folder as it was, kept for the Undo. Deleting it removes the folder and every folder under it and moves every note
 * under it (at any depth) up to the folder's parent, dropping the notes' ranks; this is what puts all of that back.
 */
export interface FolderSnapshot {
  /** The folder first, then every folder under it, as they were (ranks included). */
  folders: Folder[];
  /** Each note that was under it: the folder it was in and its rank. */
  notes: { id: string; folderId: string; order?: number }[];
  /** Where the notes went: the folder's parent (null: the vault root). */
  parentId: string | null;
  /** Where the folder's directory went in .trash, or null when there was none: Undo puts it back from there. Set once it is deleted. */
  trashPath: string | null;
}

/** What deleting folder `id` would remove and move; null when there is no such folder. */
export function snapshotFolder(
  folders: Folder[],
  notes: NoteAt[],
  id: string,
): FolderSnapshot | null {
  const root = folders.find((f) => f.id === id);
  if (!root) return null;
  return {
    folders: [root, ...folders.filter((f) => f.id.startsWith(`${id}/`))],
    notes: notes.flatMap((n) =>
      n.folderId !== null && isInside(n.folderId, id)
        ? [{ id: n.id, folderId: n.folderId, order: n.order }]
        : [],
    ),
    parentId: root.parentId,
    trashPath: null,
  };
}

/** What an Undo does: the folders to add back and the notes to move back (with the rank each had). */
export interface RestorePlan {
  folders: Folder[];
  moves: { id: string; folderId: string; order?: number }[];
}

/**
 * Works out the Undo of a folder delete against what is there now, or says why it cannot be exact: the place is taken by a
 * folder of the same name, or the folder it sat in is gone. A note that is no longer where the delete put it (moved on, trashed)
 * is left alone: that is something the user did since.
 */
export function planRestore(
  snapshot: FolderSnapshot,
  folders: Folder[],
  notes: NoteAt[],
): RestorePlan | { problem: string } {
  const root = snapshot.folders[0];
  const { parentId } = snapshot;
  if (parentId !== null && !folders.some((f) => f.id === parentId))
    return { problem: "The folder it was in no longer exists." };
  const taken = root.name.toLowerCase();
  if (namesUnder(folders, parentId).some((n) => n.toLowerCase() === taken))
    return { problem: `A folder named "${root.name}" already exists here.` };
  const there = new Map(notes.map((n) => [n.id, n.folderId]));
  return {
    folders: snapshot.folders.filter(
      (f) => !folders.some((x) => x.id === f.id),
    ),
    moves: snapshot.notes.filter((n) => there.get(n.id) === parentId),
  };
}

/** Why folder `id` cannot go under `newParentId` (null: the vault root), in plain words, or null when it can. */
export function moveProblem(
  folders: Folder[],
  id: string,
  newParentId: string | null,
): string | null {
  const folder = folders.find((f) => f.id === id);
  if (!folder) return "The folder is gone.";
  if (folder.parentId === newParentId) return "It is already there.";
  if (isInside(newParentId, id))
    return "A folder cannot go into itself or into a folder inside it.";
  if (newParentId !== null && !folders.some((f) => f.id === newParentId))
    return "The folder to move it into is gone.";
  return validateFolderName(
    folder.name,
    namesUnder(folders, newParentId),
    undefined,
    newParentId,
  );
}

/** The folder and every folder above it, nearest first: "A/B/C" gives A/B/C, A/B, A; the vault root (null) gives none. */
export function folderChain(folderId: string | null): string[] {
  const out: string[] = [];
  for (
    let at = folderId;
    at;
    at = at.includes("/") ? at.slice(0, at.lastIndexOf("/")) : null
  )
    out.push(at);
  return out;
}

/** A folder path (of a folder or a note) after the folder `oldId` became `newId`: the folder and what is under it follow; the rest stays. */
export function reId(
  path: string | null,
  oldId: string,
  newId: string,
): string | null {
  if (path === null) return null;
  if (path === oldId) return newId;
  return path.startsWith(`${oldId}/`) ? newId + path.slice(oldId.length) : path;
}

/**
 * The folders after `oldId` became `newId` (a rename, or a move under another parent): the folder, with its name and parent
 * read from `newId`, and every folder under it follow. A folder in a new parent has no place in that parent's order yet, so its
 * rank goes; what is under it keeps its own ranks.
 */
export function movedFolders(
  folders: Folder[],
  oldId: string,
  newId: string,
): Folder[] {
  const cut = newId.lastIndexOf("/");
  const parentId = cut < 0 ? null : newId.slice(0, cut);
  return folders.map((f) => {
    if (f.id === oldId) {
      const moved = { ...f, id: newId, name: newId.slice(cut + 1), parentId };
      if (parentId !== f.parentId) delete moved.order;
      return moved;
    }
    if (!f.id.startsWith(`${oldId}/`)) return f;
    return {
      ...f,
      id: reId(f.id, oldId, newId) ?? f.id,
      parentId: reId(f.parentId, oldId, newId),
    };
  });
}
