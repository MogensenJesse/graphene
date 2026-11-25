// src/lib/startVault.ts
// Which vault the app opens at start (pure, tested), and whether that is not the one it had.
import {
  findVault,
  pathKey,
  setActive,
  type VaultConfig,
  type VaultEntry,
} from "./vaultList";

export interface StartVault {
  config: VaultConfig;
  /** The saved vault is on the list but its folder is missing, and `opened` was opened instead: the person is told once. */
  fellBack: { wanted: VaultEntry; opened: VaultEntry } | null;
}

/**
 * The saved vault, or the first whose folder is there (`gone` holds the pathKeys of the folders that are missing). With no
 * folder at all the saved one stays, and VaultUnavailable says why. A saved vault that is not on the list (a first run, a stale
 * path) is not a fall back: nothing was wanted.
 */
export function startVault(
  loaded: VaultConfig,
  gone: ReadonlySet<string>,
): StartVault {
  const wanted = findVault(loaded.vaults, loaded.active);
  const there = (v: VaultEntry) => !gone.has(pathKey(v.path));
  if (wanted && there(wanted))
    return { config: setActive(loaded, wanted.path), fellBack: null };
  const opened = loaded.vaults.find(there);
  if (!opened) return { config: loaded, fellBack: null };
  return {
    config: setActive(loaded, opened.path),
    fellBack: wanted ? { wanted, opened } : null,
  };
}
