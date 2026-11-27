// src/components/sidebar/trashLabel.ts

/** The name of the Trash button, with how many notes are in it (a vault that cannot be opened has no count) */
export function trashLabel(unavailable: boolean, count: number): string {
  return unavailable
    ? "Trash"
    : `Trash, ${count} ${count === 1 ? "note" : "notes"}`;
}
