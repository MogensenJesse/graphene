// src/lib/fileDrop.ts
// What a drop of files from Explorer can do, decided from the file names alone (hooks/useFileDrop does the reading and writing).
import { isImagePath } from "./attachments";
import { CODE_EXTS } from "./fileFormat";
import { extOf, fileName, joinPath } from "./paths";

/** What a dropped file becomes: a note (.md), a code note (a code file), a picture for the open note, or nothing. */
export type DropKind = "note" | "code" | "image" | "other";

export function dropKind(path: string): DropKind {
  const ext = extOf(fileName(joinPath(path)));
  if (ext === "md") return "note";
  if (CODE_EXTS.has(ext)) return "code";
  return isImagePath(path) ? "image" : "other";
}

/** The overlay's words while files are dragged over the window: what a drop would do here. */
export const DROP_HINT = "Drop .md or code files to import them as notes";
export const DROP_HINT_PICTURES = "Pictures go into the note you are editing";
/** The Tasks tab imports nothing: notes made there would appear in a tab nobody is looking at. */
export const DROP_HINT_TASKS = "Switch to the Notes tab to import files";

/**
 * The note to the user after a drop that left something out: the files Graphene does not import (by name), and the pictures that
 * had no open note to go into. Null when everything was taken.
 */
export function dropNotice(
  skipped: string[],
  strandedPictures: number,
): string | null {
  const parts: string[] = [];
  if (skipped.length > 0)
    parts.push(
      `${skipped.length === 1 ? `"${skipped[0]}" was` : `${skipped.length} files were`} not imported. Graphene imports .md files and code files (.${[...CODE_EXTS].join(", .")}).`,
    );
  if (strandedPictures > 0)
    parts.push(
      `Open a note in the editor to add ${strandedPictures === 1 ? "a picture" : "pictures"} to it.`,
    );
  return parts.length > 0 ? parts.join(" ") : null;
}
