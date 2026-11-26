// src/hooks/useVaultRefresh.ts
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { onAppFocus } from "../lib/appFocus";
import { outsideChange } from "../lib/editConflict";
import {
  itemsFromRescan,
  mergeFolders,
  mergeItems,
  sameItem,
  stampsAfter,
} from "../lib/mergeScan";
import {
  POLL_MS,
  pollWantsRescan,
  shouldPoll,
  statStamp,
} from "../lib/noteStamp";
import { rescanDue } from "../lib/rescanGate";
import { rescanVault, writeState } from "../lib/storage";
import { requireRoot, VaultMissingError } from "../lib/vaultRoot";
import type { FileStamp } from "../lib/vaultScan";
import type { Folder, Item } from "../types";
import { useLatest } from "./useLatest";

// A rescan that overlapped one of our own writes is thrown away and tried again after this
const REFRESH_RETRY_MS = 1500;

interface VaultRefreshOptions {
  vaultPath: string;
  itemsRef: RefObject<Item[]>;
  setItems: Dispatch<SetStateAction<Item[]>>;
  setFolders: Dispatch<SetStateAction<Folder[]>>;
  /** The note the editor writes to, or null; cleared here when that note was deleted outside. */
  editingIdRef: RefObject<string | null>;
  /** Whether the editor holds typing that is not saved yet. */
  isEditorDirty: boolean;
  /** The notes whose newest write failed (the ids are the keys): memory is ahead of the disk, so a scan leaves them alone. */
  unsaved: ReadonlyMap<string, unknown>;
  /** The open note changed on disk and the editor has to reopen on the new text. */
  onReopenEditor: () => void;
  /**
   * Called on every scan that applies: their version of the open note when it changed on disk while the editor holds typing that is
   * not saved (lib/editConflict), else null. The editor then holds its autosave and asks; a scan that finds nothing clears the question.
   */
  onConflict: (theirs: Item | null) => void;
  /** The file each note was found in by the last scan (useItems): only the notes whose file changed are read again. Updated here. */
  files: Map<string, FileStamp>;
  /** The first scan has landed: before it there is nothing to compare with, and a rescan would read every note. */
  ready: boolean;
  /** VaultUnavailable is showing (the vault could not be opened at start, or went missing and nothing was unsaved): a focus reloads the vault with `onRetryLoad` instead of rescanning. */
  unavailable: boolean;
  /** The bar about a missing vault folder is showing over a working app (there were unsaved edits): the scan is tried again on the poll's beat until the folder is back. */
  missing: boolean;
  /** A rescan failed and the vault folder is not there (see lib/vaultGone for what the app does). Called on every such rescan. */
  onVaultGone: () => void;
  /** A rescan worked while `missing` was set: the folder is back. */
  onVaultBack: () => void;
  /** Loads the vault again, as the "Try again" button does. */
  onRetryLoad: () => void;
}

/**
 * Notes changed outside Graphene (another editor, Dropbox, git) show up when the window gets focus, and a change to the note open in
 * the editor also while the window stays focused: every POLL_MS one stat of its file (lib/noteStamp; none while no note is open, the
 * window is hidden or a rescan runs), which asks for a rescan only when the file is not what Graphene last saved or read. Our own
 * writes refresh that stamp (useItems), so they never trigger it. A rescan that fails because the vault folder is gone is reported
 * (`onVaultGone`, see lib/vaultGone). Returns the function that runs a rescan now, for the missing-folder bar's "Try again".
 * The editor copies its note when it opens, so one with unsaved typing keeps its own text, and when the file on disk is not what
 * Graphene last saved the person is asked which one to keep (`onConflict`); a clean one is reopened on what is on disk. A note whose
 * write failed keeps its text too, until a write lands. The scan lists every note (one call), and only the notes whose file is new or
 * changed since the last scan (path, time or size) are read; the others keep their object and their text.
 */
export function useVaultRefresh(options: VaultRefreshOptions): () => void {
  const latest = useLatest(options);
  const refreshing = useRef(false);
  const lastRefresh = useRef(Date.now());
  const refreshNow = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const refresh = async () => {
      if (refreshing.current || !latest.current.ready) return;
      refreshing.current = true;
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const before = writeState();
          // Trash is left out: it only changes through our own actions (an outside change shows after a restart)
          const scanned = await rescanVault(
            latest.current.vaultPath,
            latest.current.files,
            new Set(latest.current.itemsRef.current.map((i) => i.id)),
          );
          const after = writeState();
          if (before.pending || after.pending || before.seq !== after.seq) {
            // A save, move or delete of ours ran during the scan, which may have caught a file mid-move
            await new Promise((resolve) =>
              setTimeout(resolve, REFRESH_RETRY_MS),
            );
            continue;
          }
          const {
            itemsRef,
            setItems,
            setFolders,
            editingIdRef,
            isEditorDirty,
            unsaved,
            onReopenEditor,
            onConflict,
            files,
            missing,
            onVaultBack,
          } = latest.current;
          // The notes as the disk has them: a note that was not read is the one in memory
          const onDisk = itemsFromRescan(
            itemsRef.current,
            scanned.notes,
            scanned.bodies,
          );
          const open = editingIdRef.current;
          const dirty = open !== null && isEditorDirty;
          const mine = open
            ? itemsRef.current.find((i) => i.id === open)
            : undefined;
          const disk = open ? onDisk.find((i) => i.id === open) : undefined;
          if (open && !dirty) {
            if (!disk)
              editingIdRef.current = null; // deleted outside: the editor goes with it
            else if (mine && !sameItem(mine, disk)) onReopenEditor();
          }
          // Typing that is not saved against a file that is not what we saved: the editor holds its autosave and asks. A file that
          // had to be read and could not be says nothing either way, so an open question stays open
          if (!(open && scanned.read.has(open) && !scanned.bodies.has(open)))
            onConflict(
              outsideChange({
                mine,
                disk,
                dirty,
                unsaved: open !== null && unsaved.has(open),
              }),
            );
          const keep = new Set(unsaved.keys());
          if (open && dirty) keep.add(open);
          setItems((prev) => mergeItems(prev, onDisk, keep));
          setFolders((prev) => mergeFolders(prev, scanned.folders));
          // What this scan saw is what the next one compares with
          const seen = stampsAfter(
            files,
            scanned.notes,
            scanned.read,
            scanned.bodies,
            keep,
          );
          files.clear();
          for (const [id, stamp] of seen) files.set(id, stamp);
          if (missing) onVaultBack(); // the scan listed the folder: it is there again
          return;
        }
      } catch (err) {
        if (!latest.current.missing) console.error("[useVaultRefresh]", err);
        // A scan can fail for other reasons (a locked folder for a moment): only a vault folder that is not there is acted on
        if (await vaultFolderMissing(latest.current.vaultPath))
          latest.current.onVaultGone();
      } finally {
        refreshing.current = false;
      }
    };
    refreshNow.current = refresh;

    const stopFocus = onAppFocus(() => {
      if (!rescanDue(lastRefresh.current, Date.now())) return;
      lastRefresh.current = Date.now();
      // VaultUnavailable is showing: coming back to the window is the moment to look for the folder again
      if (latest.current.unavailable) latest.current.onRetryLoad();
      else refresh();
    });

    // The window stays focused while another program writes the open note: look at its file now and then (see the header)
    let polling = false;
    let acted: { id: string; seen: FileStamp | null } | undefined;
    const poll = async () => {
      const { editingIdRef, files, ready, unavailable, missing, vaultPath } =
        latest.current;
      if (document.hidden || unavailable || !ready) return;
      // The missing-folder bar waits for the folder: a scan on this beat finds it again without a focus
      if (missing) return void refresh();
      const openId = editingIdRef.current;
      if (
        openId === null ||
        !shouldPoll({
          openId,
          hidden: document.hidden,
          ready,
          busy: polling || refreshing.current,
        })
      )
        return;
      const known = files.get(openId);
      if (!known) return;
      polling = true;
      try {
        const before = writeState();
        const seen = await statStamp(vaultPath, known.path);
        const after = writeState();
        // A write of ours ran meanwhile (its own stamp follows), or the editor moved on to another note
        if (
          before.pending ||
          after.pending ||
          before.seq !== after.seq ||
          editingIdRef.current !== openId ||
          files.get(openId) !== known
        )
          return;
        const last = acted?.id === openId ? acted.seen : undefined;
        if (!pollWantsRescan(known, seen, last)) return;
        acted = { id: openId, seen };
        await refresh();
      } finally {
        polling = false;
      }
    };
    const timer = setInterval(poll, POLL_MS);
    return () => {
      clearInterval(timer);
      stopFocus();
    };
  }, [latest]);

  return useCallback(() => void refreshNow.current(), []);
}

/** A rescan failed: whether that is because the vault folder is not there (as `requireRoot` finds it, which looks at the disk after a failed scan). */
async function vaultFolderMissing(vaultPath: string): Promise<boolean> {
  try {
    await requireRoot(vaultPath);
    return false;
  } catch (err) {
    return err instanceof VaultMissingError;
  }
}
