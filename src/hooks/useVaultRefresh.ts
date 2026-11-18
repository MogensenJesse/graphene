// src/hooks/useVaultRefresh.ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
} from "react";
import { mergeFolders, mergeItems, sameItem } from "../lib/mergeScan";
import { loadVault, writeState } from "../lib/storage";
import type { Folder, Item } from "../types";
import { useLatest } from "./useLatest";

// Coming back to the window rescans the vault, but not more often than this
const REFRESH_MIN_MS = 5000;
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
  /** The open note changed on disk and the editor has to reopen on the new text. */
  onReopenEditor: () => void;
}

/**
 * Notes changed outside Graphene (another editor, Dropbox, git) show up when the window gets focus.
 * The editor copies its note when it opens, so one with unsaved typing keeps its own text (its next
 * autosave wins, as before); a clean one is reopened on what is on disk.
 */
export function useVaultRefresh(options: VaultRefreshOptions): void {
  const latest = useLatest(options);
  const refreshing = useRef(false);
  const lastRefresh = useRef(Date.now());

  useEffect(() => {
    const refresh = async () => {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const before = writeState();
          // Trash is left out: it only changes through our own actions (an outside change shows after a restart)
          const scanned = await loadVault(latest.current.vaultPath, false);
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
            onReopenEditor,
          } = latest.current;
          const open = editingIdRef.current;
          const dirty = open !== null && isEditorDirty;
          if (open && !dirty) {
            const mine = itemsRef.current.find((i) => i.id === open);
            const disk = scanned.items.find((i) => i.id === open);
            if (!disk)
              editingIdRef.current = null; // deleted outside: the editor goes with it
            else if (mine && !sameItem(mine, disk)) onReopenEditor();
          }
          setItems((prev) =>
            mergeItems(prev, scanned.items, dirty ? open : null),
          );
          setFolders((prev) => mergeFolders(prev, scanned.folders));
          return;
        }
      } catch (err) {
        console.error("[useVaultRefresh]", err);
      } finally {
        refreshing.current = false;
      }
    };

    const unlisten = getCurrentWindow().onFocusChanged(
      ({ payload: focused }) => {
        if (!focused || Date.now() - lastRefresh.current < REFRESH_MIN_MS)
          return;
        lastRefresh.current = Date.now();
        refresh();
      },
    );
    return () => {
      unlisten.then((fn) => fn()).catch(console.error);
    };
  }, [latest]);
}
