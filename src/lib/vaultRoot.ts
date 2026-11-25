// src/lib/vaultRoot.ts
// A write never makes a vault's own folder. `mkdir` with `recursive` would: a vault that was renamed, deleted or unplugged
// would silently become an empty new folder and the save would land in it. So every path that is about to make a folder in a
// vault (a note, a folder, a picture, the task store) first asks `requireRoot`, which rejects when the vault folder is not
// there. A scan that listed the folder (loadVault, rescanVault) marks it as seen, so the usual save costs no extra call; a
// failed scan or a failed write forgets it, so the next write looks again. Subfolders below a vault that is there are made as before.
import { exists } from "@tauri-apps/plugin-fs";
import { joinPath } from "./paths";

/** The vault folder is not there. Its message finishes a sentence: `Could not save "Plan": the vault folder is not there`. */
export class VaultMissingError extends Error {
  constructor() {
    super("the vault folder is not there");
    this.name = "VaultMissingError";
  }
}

// Vault folders a scan has listed or a write has found, as joinPath writes them (one spelling for "\" and "/")
const seen = new Set<string>();

export function rootSeen(root: string): void {
  seen.add(joinPath(root));
}

export function rootLost(root: string): void {
  seen.delete(joinPath(root));
}

/** Resolves when the vault's folder is there; rejects with `VaultMissingError` when it is not (or cannot be looked at). */
export async function requireRoot(root: string): Promise<void> {
  const key = joinPath(root);
  if (seen.has(key)) return;
  let there = false;
  try {
    there = await exists(key);
  } catch {
    // a folder that cannot be looked at counts as missing, as in vaultFolderExists
  }
  if (!there) throw new VaultMissingError();
  seen.add(key);
}
