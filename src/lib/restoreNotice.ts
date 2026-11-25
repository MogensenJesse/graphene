// src/lib/restoreNotice.ts
// What the toast says after a note is restored from the Trash view (pure, tested).

// A folder's id is its path from the vault, so its names are in it: "Work/Specs" reads "Work / Specs", as the Trash rows show it
const label = (folderId: string) => folderId.split("/").join(" / ");

/**
 * `wanted` is the folder the note was trashed from, `landed` the one it was restored into (storage's restoreItemFile falls back to
 * the vault root, `null`, when the folder is gone). The folder is named even when it no longer exists.
 */
export function restoreNotice(
  title: string,
  wanted: string | null,
  landed: string | null,
): string {
  const note = `"${title.trim() || "Untitled"}"`;
  if (wanted !== null && landed === null)
    return `Restored ${note} to the top level because ${label(wanted)} no longer exists`;
  return `Restored ${note} to ${landed === null ? "the top level" : label(landed)}`;
}
