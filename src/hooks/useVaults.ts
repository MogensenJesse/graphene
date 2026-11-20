// src/hooks/useVaults.ts
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadVaultConfig,
  saveVaultConfig,
  vaultFolderExists,
} from "../lib/vault";
import {
  addVault,
  EMPTY_CONFIG,
  findVault,
  moveVault,
  pathKey,
  removeVault,
  renameVault,
  setActive,
  setShared,
  type VaultConfig,
  type VaultEntry,
  type VaultProblem,
} from "../lib/vaultList";
import { useLatest } from "./useLatest";

export interface Vaults {
  /** False until config.json has been read */
  ready: boolean;
  /** config.json could not be read: it was kept as config.json.bak and the list starts empty */
  corrupt: boolean;
  vaults: VaultEntry[];
  /** The open vault; null when there are none (the first-run screen) */
  active: string | null;
  /** Whether the folder of this vault was missing the last time it was looked at */
  isMissing: (path: string) => boolean;
  /** Looks at every folder again (a drive came back, a folder was deleted) */
  recheck: () => Promise<void>;
  /** False when the folder is missing */
  switchTo: (path: string) => Promise<boolean>;
  /** Adds the folder and opens it. A problem (already a vault, overlaps one) means nothing was added. */
  add: (path: string) => Promise<VaultProblem | null>;
  /** Takes it off the list; the folder and its notes stay on disk */
  remove: (path: string) => Promise<void>;
  /** False when the name is empty or taken */
  rename: (path: string, name: string) => boolean;
  move: (path: string, delta: -1 | 1) => void;
  setShared: (path: string, shared: boolean) => void;
}

async function missingKeys(vaults: VaultEntry[]): Promise<Set<string>> {
  const found = await Promise.all(
    vaults.map(async (v) => [v, await vaultFolderExists(v.path)] as const),
  );
  return new Set(found.filter(([, ok]) => !ok).map(([v]) => pathKey(v.path)));
}

/**
 * The list of vaults and which one is open. Every change is saved at once (config.json is a full snapshot of
 * this list). `flushNow` saves what is typed in the editor; it runs before the open vault changes, so that
 * note lands in the vault it was written in.
 */
export function useVaults(flushNow: () => void): Vaults {
  const [config, setConfig] = useState<VaultConfig>(EMPTY_CONFIG);
  const [ready, setReady] = useState(false);
  const [corrupt, setCorrupt] = useState(false);
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  // Handlers can run twice before a render: they build on this, not on the state of their last render
  const configRef = useRef<VaultConfig>(EMPTY_CONFIG);
  const switching = useRef(false);
  const flush = useLatest(flushNow);

  const commit = useCallback((next: VaultConfig) => {
    configRef.current = next;
    setConfig(next);
    saveVaultConfig(next).catch((err) =>
      console.error("[vaults] could not save the vault list:", err),
    );
  }, []);

  const markMissing = useCallback((path: string, isMissing: boolean) => {
    setMissing((prev) => {
      const next = new Set(prev);
      if (isMissing) next.add(pathKey(path));
      else next.delete(pathKey(path));
      return next;
    });
  }, []);

  const recheck = useCallback(async () => {
    setMissing(await missingKeys(configRef.current.vaults));
  }, []);

  // Start: the saved vault, or the first one whose folder is there. Not saved: only a change by the person is.
  useEffect(() => {
    let cancelled = false;
    loadVaultConfig().then(async ({ config: loaded, corrupt: bad }) => {
      const gone = await missingKeys(loaded.vaults);
      if (cancelled) return;
      const open = findVault(loaded.vaults, loaded.active);
      const usable =
        open && !gone.has(pathKey(open.path))
          ? open
          : loaded.vaults.find((v) => !gone.has(pathKey(v.path)));
      const start = usable ? setActive(loaded, usable.path) : loaded;
      configRef.current = start;
      setConfig(start);
      setMissing(gone);
      setCorrupt(bad);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A drive that came back, or a folder deleted meanwhile, shows when the window gets focus
  useEffect(() => {
    window.addEventListener("focus", recheck);
    return () => window.removeEventListener("focus", recheck);
  }, [recheck]);

  const switchTo = useCallback(
    async (path: string) => {
      const target = findVault(configRef.current.vaults, path);
      if (!target || switching.current) return false;
      if (pathKey(target.path) === pathKey(configRef.current.active ?? ""))
        return true;
      switching.current = true;
      try {
        const there = await vaultFolderExists(target.path);
        markMissing(target.path, !there);
        if (!there) return false;
        flush.current();
        commit(setActive(configRef.current, target.path));
        return true;
      } finally {
        switching.current = false;
      }
    },
    [commit, flush, markMissing],
  );

  const add = useCallback(
    async (path: string) => {
      const result = addVault(configRef.current, path);
      if ("kind" in result) return result;
      flush.current();
      markMissing(path, false);
      commit(setActive(result.config, result.entry.path));
      return null;
    },
    [commit, flush, markMissing],
  );

  const remove = useCallback(
    async (path: string) => {
      const wasOpen = pathKey(configRef.current.active ?? "") === pathKey(path);
      let heir: string | undefined;
      if (wasOpen) {
        // The first of the others whose folder is there; removeVault falls back to the first one
        for (const v of configRef.current.vaults) {
          if (pathKey(v.path) === pathKey(path)) continue;
          if (await vaultFolderExists(v.path)) {
            heir = v.path;
            break;
          }
        }
        flush.current();
      }
      const rest = removeVault(configRef.current, path);
      commit(heir ? setActive(rest, heir) : rest);
    },
    [commit, flush],
  );

  const rename = useCallback(
    (path: string, name: string) => {
      const next = renameVault(configRef.current, path, name);
      if (next) commit(next);
      return next !== null;
    },
    [commit],
  );

  const move = useCallback(
    (path: string, delta: -1 | 1) =>
      commit(moveVault(configRef.current, path, delta)),
    [commit],
  );

  const share = useCallback(
    (path: string, shared: boolean) =>
      commit(setShared(configRef.current, path, shared)),
    [commit],
  );

  return {
    ready,
    corrupt,
    vaults: config.vaults,
    active: findVault(config.vaults, config.active)?.path ?? null,
    isMissing: (path) => missing.has(pathKey(path)),
    recheck,
    switchTo,
    add,
    remove,
    rename,
    move,
    setShared: share,
  };
}
