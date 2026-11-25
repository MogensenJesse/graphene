// src/lib/rescanGate.ts
// Coming back to the window rescans the notes (useVaultRefresh) and re-reads the task files (useTasks). The window gets focus
// more often than it seems (restoring a minimised one sends several events in a row), and each rescan is a read of the vault or
// of every task file, so one runs at most this often.
export const RESCAN_MIN_MS = 5000;

/** Whether enough time has passed since the last rescan started (`last` and `now` in milliseconds, as `Date.now()`). */
export const rescanDue = (last: number, now: number): boolean =>
  now - last >= RESCAN_MIN_MS;
