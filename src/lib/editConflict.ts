// src/lib/editConflict.ts
// An outside edit against a dirty editor (pure, tested; the pieces are in useVaultRefresh, NoteEditor and App).
// The editor autosaves, so without this the next autosave silently wins over a change another program (the MCP server, a sync
// tool, another editor) made to the open note. While the editor holds typing that is not saved and the file on disk is not what
// Graphene last saved or read, the editor holds its autosave and asks: Keep mine (its text is saved over the file) or Load theirs
// (the editor reopens on the file's text and the typing is discarded). Leaving the note, the vault or the window with the
// question open never loses either one: the editor's text is saved as a copy note, and the file stays as the note.
import type { Item } from "../types";
import { sameItem } from "./mergeScan";

/**
 * The version on disk of the open note when it was changed outside while the editor has typing that is not saved, else null.
 * `mine` is the note in memory: what Graphene last saved or read (the editor copies it when it opens, and every autosave updates
 * it), so a file that differs from it was written by someone else. A rescan that overlaps one of our own writes is thrown away
 * before this, so our own save is never taken for theirs. Nothing is asked when the note's last write failed (`unsaved`: memory
 * is ahead of the disk and the retry is the answer), when the file is gone (the next save makes it again, as before), or when the
 * editor is not dirty (then the editor just reopens on the file's text).
 */
export function outsideChange(open: {
  mine: Item | undefined;
  disk: Item | undefined;
  dirty: boolean;
  unsaved: boolean;
}): Item | null {
  const { mine, disk, dirty, unsaved } = open;
  if (!dirty || unsaved || !mine || !disk) return null;
  if (mine.unloaded || disk.unloaded) return null;
  return sameItem(mine, disk) ? null : disk;
}

/**
 * What the editor does when it is told to flush (the note, the vault or the window is being left, or the editor is asked to save):
 *   save    typing that is not saved, no question open
 *   copy    a question is open and there is typing: save it as a copy note and reopen on the file's version
 *   reload  a question is open but the typing is gone again: just reopen on the file's version
 *   none    nothing to do
 * It never writes over the file while a question is open.
 */
export type LeaveAction = "save" | "copy" | "reload" | "none";

export function leaveAction(conflict: boolean, dirty: boolean): LeaveAction {
  if (conflict) return dirty ? "copy" : "reload";
  return dirty ? "save" : "none";
}

/** The title of the copy that keeps the editor's text next to the note. */
export const conflictCopyTitle = (title: string): string =>
  `${title.trim() || "Untitled"} (conflict copy)`;
