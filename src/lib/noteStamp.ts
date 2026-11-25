// src/lib/noteStamp.ts
// The stamp of a note's file (path, modified time, size: lib/vaultScan `FileStamp`) outside a scan.
//   - After the app writes a note, its stamp is read again (`noteStamp`, one stat), so the next focus rescan sees our own file as
//     unchanged and reads only what really changed outside. An outside change made after that has another time or size and is read.
//   - While a note is open in the editor, `useVaultRefresh` stats its file every POLL_MS (`statStamp`) and asks for a rescan when
//     the file is no longer what Graphene last saved or read (`pollWantsRescan`), so the conflict bar does not wait for the window to
//     get focus. `shouldPoll` is when it looks at all.
import { stat } from "@tauri-apps/plugin-fs";
import type { Item } from "../types";
import { itemFilePath } from "./itemPaths";
import { joinPath, relativePath } from "./paths";
import type { FileStamp } from "./vaultScan";

/** How often the open note's file is looked at. One stat call each time, and none while nothing needs it (`shouldPoll`). */
export const POLL_MS = 3000;

/** What the fs plugin's `stat` gives, in the part used here. */
export interface StatInfo {
  mtime: Date | null;
  size: number;
}

/** A stamp as the scan makes it (whole milliseconds, bytes), or null when the platform gives no modified time. */
export function stampFromStat(path: string, info: StatInfo): FileStamp | null {
  return info.mtime === null
    ? null
    : { path, mtimeMs: Math.floor(info.mtime.getTime()), size: info.size };
}

export const sameStamp = (
  a: FileStamp | null | undefined,
  b: FileStamp | null | undefined,
): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    a.path === b.path &&
    a.mtimeMs === b.mtimeMs &&
    a.size === b.size);

/** Whether the open note's file is looked at on this tick: a note is open in the editor, the window is shown, the first scan has landed and no rescan is running. */
export const shouldPoll = (state: {
  openId: string | null;
  hidden: boolean;
  ready: boolean;
  busy: boolean;
}): boolean =>
  state.openId !== null && !state.hidden && state.ready && !state.busy;

/**
 * Whether what a poll saw asks for a rescan: the file is not what Graphene last saved or read (`known`: the scan's stamp, made again
 * after each of our own writes), or it is gone or cannot be looked at (`seen` null). `acted` is the state the last poll already
 * rescanned for (undefined: none yet), so a file that stays changed, or gone, is not rescanned every tick; the rescan makes `known`
 * follow when it could read the file. A note with no stamp yet (a new one, not written) has nothing to compare with.
 */
export function pollWantsRescan(
  known: FileStamp | undefined,
  seen: FileStamp | null,
  acted: FileStamp | null | undefined,
): boolean {
  if (!known || sameStamp(known, seen)) return false;
  return acted === undefined || !sameStamp(acted, seen);
}

/** The stamp of a file in the vault (`rel`: its path from the vault, as the scan gives it) as it is now; null when it is gone or cannot be looked at. */
export async function statStamp(
  vaultPath: string,
  rel: string,
): Promise<FileStamp | null> {
  try {
    return stampFromStat(rel, await stat(joinPath(vaultPath, rel)));
  } catch {
    return null;
  }
}

/**
 * The stamp of a note's file right after the app wrote it, or null when it cannot be looked at (then the next rescan reads the
 * note again, as it did before stamps were refreshed). ponytail: an outside write between our write and this stat is taken for ours.
 */
export const noteStamp = (vaultPath: string, item: Item) =>
  statStamp(vaultPath, relativePath(vaultPath, itemFilePath(vaultPath, item)));
