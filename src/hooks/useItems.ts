// src/hooks/useItems.ts
import { nanoid } from "nanoid";
import { useCallback, useRef, useState } from "react";
import { ownImagesIn, relinkAttachments } from "../lib/attachments";
import { applyBodies, mergeTrash } from "../lib/mergeScan";
import { noteStamp } from "../lib/noteStamp";
import { reportError } from "../lib/reportError";
import {
  emptyTrashFiles,
  loadTrash,
  moveItemFile,
  replaceItemFile,
  restoreItemFile,
  saveItem,
  sweepUnusedImages,
  trashItemFile,
  type VaultLoad,
} from "../lib/storage";
import { type FileStamp, readBodies } from "../lib/vaultScan";
import { createWriteQueue } from "../lib/writeQueue";
import type { Item } from "../types";
import { useBodies } from "./useBodies";
import { useListRef } from "./useListRef";

// A text read from disk never has a note to keep (applyBodies' `keep` is for the notes whose write failed: none are in the trash)
const KEEP_NONE: ReadonlySet<string> = new Set();

export type AddItemFields = Pick<Item, "title" | "body" | "folderId">;
export type UpdateItemFields = Partial<Omit<Item, "id" | "createdAt">>;

// A note the scan listed without its text (`Item.unloaded`) is never written: storage refuses it, and every call below that
// would write one reads its text first (`loadBodies`) and then does what was asked, so nothing can turn a note into an empty file.
export function useItems(vaultPath: string) {
  const [items, setItems, itemsRef] = useListRef<Item>();
  const [trashed, setTrashed, trashedRef] = useListRef<Item>();
  // A note's file writes run one after the other (the trash is the key "trash"), so a slow one never lands over a
  // newer one, and `settled` can wait for all of them
  // `settled` resolves once every write started so far has landed or failed: the window waits for it before it closes
  const [{ run: queue, newest, settled }] = useState(createWriteQueue);
  // The notes whose newest write failed, each with the call that tries it again. Their text in memory is ahead of the
  // disk, so a rescan must not replace them (`mergeItems`) and closing the window runs these again (see MainApp)
  const [unsaved] = useState(() => new Map<string, () => void>());
  // The file each note was found in by the last scan: where to read its text, and what a rescan compares with (useVaultRefresh)
  const [files] = useState(() => new Map<string, FileStamp>());
  // Goes up each time a scan is adopted; above 0 means the first one has landed
  const [scanId, setScanId] = useState(0);
  // The trash is read when its view opens: until then only its size is known (the scan's count), plus what was trashed since
  const [trashBase, setTrashBase] = useState(0);
  const [trashLoaded, setTrashLoaded] = useState(false);
  const trashRead = useRef<Promise<void> | null>(null);
  // The file of each note the trash listing found, by id: where to read its text when it is restored or deleted for good
  const [trashFiles] = useState(() => new Map<string, FileStamp>());

  const { loadBodies, indexing } = useBodies({
    vaultPath,
    itemsRef,
    setItems,
    files,
    unsaved,
    scanId,
  });

  /** Takes what the scan found as the notes: no text yet, the background load fills it in (see useBodies). */
  const adoptScan = useCallback(
    (scan: VaultLoad) => {
      files.clear();
      for (const [id, stamp] of scan.files) files.set(id, stamp);
      setItems(scan.items);
      setTrashBase(scan.trashCount);
      setScanId((n) => n + 1);
    },
    [files, setItems],
  );

  /** Lists the trash when its view opens (once), without the texts (`unloaded`); the notes trashed since the start stay, with theirs. */
  const loadTrashList = useCallback((): Promise<void> => {
    trashRead.current ??= (async () => {
      await settled(); // a trash or restore that is still running must land before the folder is read
      const { items: onDisk, files: stamps } = await loadTrash(vaultPath);
      for (const [id, stamp] of stamps) trashFiles.set(id, stamp);
      const live = new Set(itemsRef.current.map((i) => i.id));
      setTrashed((prev) => mergeTrash(prev, onDisk, live));
      setTrashLoaded(true);
    })().catch((err) => {
      trashRead.current = null;
      reportError("Could not read the trash", err);
    });
    return trashRead.current;
  }, [vaultPath, settled, itemsRef, setTrashed, trashFiles]);

  /** Reads the text of a trashed note that is not loaded yet (a restore writes it back, a delete for good needs its pictures). Rejects when it cannot be read. */
  const loadTrashBody = useCallback(
    async (id: string): Promise<void> => {
      if (!trashedRef.current.some((i) => i.id === id && i.unloaded)) return;
      const { bodies, errors } = await readBodies(vaultPath, [id], trashFiles);
      if (bodies.size > 0)
        setTrashed((prev) => applyBodies(prev, bodies, KEEP_NONE));
      const failed = errors.values().next();
      if (!failed.done) throw new Error(failed.value);
    },
    [vaultPath, trashedRef, setTrashed, trashFiles],
  );

  /** Whether the newest write of a note has landed; ask right after starting it, a finished write is forgotten (that is what `unsaved` is for). False: it failed, and the user was told (the editor stays unsaved). */
  const landed = useCallback(
    async (id: string) => {
      const out = await newest(id);
      return !out || !("error" in out);
    },
    [newest],
  );

  // After a write of ours the stamp of the note's file is read again (one stat), so the next rescan takes the file for what it is, our
  // own, and reads only what changed outside; an outside write after this has another time or size and is still read (lib/noteStamp)
  const restamp = useCallback(
    async (item: Item) => {
      const stamp = await noteStamp(vaultPath, item);
      if (stamp) files.set(item.id, stamp);
    },
    [vaultPath, files],
  );

  // A write that keeps a note's text. A failure is shown with a Retry that saves the note as it is by then, so an old
  // retry never puts older text over newer typing; a note that is gone by then is not written again.
  const persist = useCallback(
    (id: string, message: string, write: (item: Item) => Promise<unknown>) => {
      const attempt = () => {
        queue(id, async () => {
          const item = itemsRef.current.find((i) => i.id === id);
          if (!item) return;
          await write(item);
          await restamp(item);
        }).then((out) => {
          if (!("error" in out)) {
            unsaved.delete(id);
            return;
          }
          unsaved.set(id, attempt);
          reportError(message, out.error, attempt);
        });
      };
      attempt();
    },
    [queue, itemsRef, unsaved, restamp],
  );

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
      persist(item.id, `Could not save "${item.title}"`, (cur) =>
        saveItem(vaultPath, cur),
      );
      return item.id;
    },
    [vaultPath, setItems, persist],
  );

  const updateItem = useCallback(
    // touch=false keeps updatedAt (folder renames/deletes must not make every item look edited)
    function update(id: string, fields: UpdateItemFields, touch = true): void {
      const old = itemsRef.current.find((i) => i.id === id);
      if (!old) return;
      // Its text is not read yet, and writing the change would need it: read it, then make the change
      if (old.unloaded) {
        const attempt = (): Promise<void> =>
          loadBodies([id]).then(
            () => {
              const now = itemsRef.current.find((i) => i.id === id);
              if (now && !now.unloaded) update(id, fields, touch);
            },
            (err) =>
              reportError(`Could not change "${old.title}"`, err, attempt),
          );
        attempt();
        return;
      }
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
      persist(id, `Could not save "${updated.title}"`, (cur) =>
        replaceItemFile(vaultPath, old, cur),
      );
    },
    [vaultPath, setItems, itemsRef, persist, loadBodies],
  );

  // Soft delete: the file moves to <vault>/.trash and the item shows up in the Trash view. The list changes at once;
  // the promise says whether the file really moved (false: nothing to trash, or it failed and the note is back)
  const deleteItem = useCallback(
    async function trash(id: string): Promise<boolean> {
      let found = itemsRef.current.find((i) => i.id === id);
      if (!found) return false;
      if (found.unloaded) {
        // The copy that goes to the Trash view is what Restore writes back, so it has to have the text
        try {
          await loadBodies([id]);
        } catch (err) {
          reportError(
            `Could not move "${found.title}" to the trash`,
            err,
            async () => {
              await trash(id);
            },
          );
          return false;
        }
        found = itemsRef.current.find((i) => i.id === id);
        if (!found || found.unloaded) return false;
      }
      const target = found;
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTrashed((prev) => [target, ...prev]);
      const out = await queue(id, () => trashItemFile(vaultPath, target));
      if (!("error" in out)) return true;
      // The file never left its folder: show the note there again, not in a Trash it is not in
      setTrashed((prev) => prev.filter((item) => item.id !== id));
      setItems((prev) =>
        prev.some((item) => item.id === id) ? prev : [target, ...prev],
      );
      reportError(
        `Could not move "${target.title}" to the trash`,
        out.error,
        async () => {
          await trash(id);
        },
      );
      return false;
    },
    [vaultPath, setItems, setTrashed, itemsRef, queue, loadBodies],
  );

  // Puts a trashed note back and gives it as restored (its folder is the vault root when its own is gone), or null when nothing was restored
  const restoreItem = useCallback(
    async function restore(id: string): Promise<Item | null> {
      let target = trashedRef.current.find((i) => i.id === id);
      if (!target) return null;
      // Restore writes the text back, so a note listed without it is read first
      if (target.unloaded) {
        try {
          await loadTrashBody(id);
        } catch (err) {
          reportError(`Could not restore "${target.title}"`, err, () => {
            restore(id);
          });
          return null;
        }
        target = trashedRef.current.find((i) => i.id === id);
        if (!target || target.unloaded) return null;
      }
      const note = target;
      const out = await queue(id, async () => {
        const restored = await restoreItemFile(vaultPath, note);
        await restamp(restored);
        return restored;
      });
      if ("error" in out) {
        reportError(`Could not restore "${note.title}"`, out.error, () => {
          restore(id);
        });
        return null;
      }
      setTrashed((prev) => prev.filter((item) => item.id !== id));
      setItems((prev) => [out.value, ...prev]);
      return out.value;
    },
    [
      vaultPath,
      setItems,
      setTrashed,
      trashedRef,
      queue,
      restamp,
      loadTrashBody,
    ],
  );

  // Removes the one file from the trash for good. A removal that fails is reported and the note stays in the list, so nothing says it is gone.
  // Then the pictures it used are looked at (`sweepUnusedImages`, only those): one still linked by any other note, live or trashed, stays
  const deleteForever = useCallback(
    async function forever(id: string): Promise<void> {
      const target = trashedRef.current.find((i) => i.id === id);
      if (!target) return;
      // Its pictures are named in its text, which goes with the file: read it first (a note that cannot be read leaves them to Empty trash)
      const pictures = await loadTrashBody(id).then(
        () =>
          ownImagesIn(trashedRef.current.find((i) => i.id === id)?.body ?? ""),
        () => [],
      );
      const out = await queue(id, () => emptyTrashFiles(vaultPath, [target]));
      if ("error" in out) {
        reportError(
          `Could not delete "${target.title}" for good`,
          out.error,
          () => {
            forever(id);
          },
        );
        return;
      }
      setTrashed((prev) => prev.filter((item) => item.id !== id));
      if (pictures.length > 0)
        sweepUnusedImages(vaultPath, pictures).catch(console.error);
    },
    [vaultPath, setTrashed, trashedRef, queue, loadTrashBody],
  );

  const emptyTrash = useCallback(() => {
    const gone = trashedRef.current;
    const empty = () =>
      queue("trash", () => emptyTrashFiles(vaultPath, gone)).then((out) => {
        // Some files may be gone and some not: the list stays as it was, so nothing claims the trash is empty
        if ("error" in out)
          return reportError("Could not empty the trash", out.error, empty);
        setTrashed((prev) =>
          prev.filter((i) => !gone.some((g) => g.id === i.id)),
        );
        // The notes that used pictures are gone now, so look for pictures nothing links to
        return sweepUnusedImages(vaultPath).catch(console.error);
      });
    empty();
  }, [vaultPath, setTrashed, trashedRef, queue]);

  const moveItem = useCallback(
    function move(id: string, newFolderId: string | null): void {
      const target = itemsRef.current.find((i) => i.id === id);
      if (!target || target.folderId === newFolderId) return;
      // Its image links may need a new "../" count, so its text is needed: read it, then move it
      if (target.unloaded) {
        const attempt = (): Promise<void> =>
          loadBodies([id]).then(
            () => {
              const now = itemsRef.current.find((i) => i.id === id);
              if (now && !now.unloaded) move(id, newFolderId);
            },
            (err) =>
              reportError(`Could not move "${target.title}"`, err, attempt),
          );
        attempt();
        return;
      }
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
      persist(id, `Could not move "${moved.title}"`, (cur) =>
        body === target.body && target.order === undefined
          ? moveItemFile(vaultPath, target, newFolderId)
          : replaceItemFile(vaultPath, target, cur),
      );
    },
    [vaultPath, setItems, itemsRef, persist, loadBodies],
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
    deleteForever,
    emptyTrash,
    landed,
    unsaved,
    settled,
    adoptScan,
    /** True once the first scan has landed (before it the list is empty because nothing is known yet, not because the vault is). */
    scanned: scanId > 0,
    files,
    loadBodies,
    /** The background load of the texts is still running. */
    indexing,
    loadTrashList,
    trashLoaded,
    /** What the sidebar shows next to the trash: the notes in it, counted from the scan until the Trash view has listed them. */
    trashCount: trashLoaded ? trashed.length : trashBase + trashed.length,
  };
}
