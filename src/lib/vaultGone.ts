// src/lib/vaultGone.ts
// A vault folder that disappears while it is open (renamed, deleted, a drive unplugged). The rescan notices it (useVaultRefresh: the
// scan fails and the folder is not there), and the app answers one of two ways. Pure and tested; the pieces are in useVaultRefresh and App.
//   unavailable  nothing would be lost: the app shows VaultUnavailable, as for a vault that cannot be opened at start, and reloads the
//                vault by itself on the next focus when the folder is there again (what "Try again" does).
//   notice       something only lives in memory (typing in an editor, a note or task whose write failed, a write still running, a task
//                field being typed in): nothing is unmounted, the edits stay, a bar says the folder is not there, and saving stays refused
//                by `requireRoot` (lib/vaultRoot) until it is back. The bar stays until then: it never turns into `unavailable`, which
//                would put the edits out of sight.

/** What the app holds that is not on disk. */
export interface UnsavedWork {
  /** The editor has typing that is not saved (a new draft counts). */
  editorDirty: boolean;
  /** Notes whose newest write failed. */
  failedNotes: number;
  /** Tasks whose newest write failed. */
  failedTasks: number;
  /** A write of a note is still running: it may yet fail. */
  writing: boolean;
  /** The caret is in a field of the Tasks pane (it commits when it loses the focus). */
  taskFieldOpen: boolean;
}

export const hasUnsavedWork = (work: UnsavedWork): boolean =>
  work.editorDirty ||
  work.failedNotes > 0 ||
  work.failedTasks > 0 ||
  work.writing ||
  work.taskFieldOpen;

/** What the main pane shows about the vault folder: all well, VaultUnavailable, or the bar over a working app. */
export type VaultShown = "ok" | "unavailable" | "notice";

/** What to show now that the folder is missing: what is showing already stays (the bar never gives way to VaultUnavailable). */
export function shownWhenGone(
  current: VaultShown,
  work: UnsavedWork,
): VaultShown {
  if (current !== "ok") return current;
  return hasUnsavedWork(work) ? "notice" : "unavailable";
}
