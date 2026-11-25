// src/lib/autosave.ts
// When the editor saves on its own: after a quiet moment, and at the latest a while after the first unsaved edit,
// so a long burst of typing (which never goes quiet) still reaches the disk.

export const AUTOSAVE_DELAY_MS = 800;
export const AUTOSAVE_MAX_WAIT_MS = 8000;

/** Milliseconds to wait from `now` before saving: the quiet time, cut short so the save lands no later than `maxWait` after `dirtySince`. */
export function autosaveDelay(
  dirtySince: number,
  now: number,
  delay = AUTOSAVE_DELAY_MS,
  maxWait = AUTOSAVE_MAX_WAIT_MS,
): number {
  return Math.max(0, Math.min(delay, dirtySince + maxWait - now));
}
