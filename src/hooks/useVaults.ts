// src/hooks/useVaults.ts
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { perfMark } from "../lib/perf";
import { IS_ANDROID } from "../lib/platform";
import { startVault } from "../lib/startVault";
import {
  deletePrivateVaultFolder,
  loadVaultConfig,
  makePrivateVaultFolder,
  saveVaultConfig,
  vaultFolderExists,
  withPrivateVault,
} from "../lib/vault";
import {
  addVault,
  EMPTY_CONFIG,
  findVault,
  moveVault,
  nameTaken,
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

export type CreateResult = "created" | "empty" | "taken" | "unsaved" | "failed";
export type EraseResult = "erased" | "last" | "unsaved" | "failed";

export interface Vaults {
  /** False until config.json has been read */
  ready: boolean;
  /** config.json could not be read: it was kept as config.json.bak and the list starts empty */
  corrupt: boolean;
  /** At start the saved vault's folder was missing and another vault was opened instead: their names, for a notice (null otherwise) */
  fellBack: { wanted: string; opened: string } | null;
  vaults: VaultEntry[];
  /** The open vault; null when there are none (the first-run screen) */
  active: string | null;
  /** Whether the folder of this vault was missing the last time it was looked at */
  isMissing: (path: string) => boolean;
  /** Looks at every folder again (a drive came back, a folder was deleted) */
  recheck: () => Promise<void>;
  /** "missing": the folder is gone. "unsaved": a note or a task could not be saved, so the switch was held back once (the toast says so) */
  switchTo: (path: string) => Promise<"opened" | "missing" | "unsaved">;
  /** Adds the folder and opens it. A problem (already a vault, overlaps one) means nothing was added; so does null when the unsaved changes held it back (the toast says so). */
  add: (path: string) => Promise<VaultProblem | null>;
  /** Takes it off the list; the folder and its notes stay on disk. False when the unsaved changes held it back (the open vault stays). */
  remove: (path: string) => Promise<boolean>;
  /**
   * Android: a new, empty vault in the app's own storage, opened at once. "unsaved": the unsaved changes held it back (the toast says
   * so); "failed": the folder could not be made.
   */
  create: (name: string) => Promise<CreateResult>;
  /**
   * Android: takes it off the list AND deletes its folder, with every note in it. Never the last vault: the app would have none and no
   * way to make one. "failed": it is off the list but its files could not be deleted.
   */
  erase: (path: string) => Promise<EraseResult>;
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
 * note lands in the vault it was written in. `canLeave` saves and waits first, and says no (after telling the person)
 * when a note or a task could not be saved: the open vault changes only when it says yes.
 */
export function useVaults(
  flushNow: () => void,
  canLeave: () => Promise<boolean>,
): Vaults {
  const [config, setConfig] = useState<VaultConfig>(EMPTY_CONFIG);
  const [ready, setReady] = useState(false);
  const [corrupt, setCorrupt] = useState(false);
  const [fellBack, setFellBack] = useState<Vaults["fellBack"]>(null);
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  // Handlers can run twice before a render: they build on this, not on the state of their last render
  const configRef = useRef<VaultConfig>(EMPTY_CONFIG);
  const switching = useRef(false);
  const flush = useLatest(flushNow);
  const leave = useLatest(canLeave);

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
    // One call to Rust gives the file and which folders are there: no round trip per vault after it
    loadVaultConfig().then(
      async ({ config: read, corrupt: bad, missing: gone }) => {
        const loaded =
          IS_ANDROID && !bad && read.vaults.length === 0
            ? await withPrivateVault(read)
            : read;
        if (cancelled) return;
        const { config: start, fellBack: fell } = startVault(loaded, gone);
        configRef.current = start;
        setConfig(start);
        if (fell)
          setFellBack({ wanted: fell.wanted.name, opened: fell.opened.name });
        setMissing(gone);
        setCorrupt(bad);
        perfMark("config-ready");
        setReady(true);
      },
    );
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
      if (!target || switching.current) return "missing";
      if (pathKey(target.path) === pathKey(configRef.current.active ?? ""))
        return "opened";
      switching.current = true;
      try {
        const there = await vaultFolderExists(target.path);
        markMissing(target.path, !there);
        if (!there) return "missing";
        if (!(await leave.current())) return "unsaved";
        flush.current(); // what was typed while it waited
        commit(setActive(configRef.current, target.path));
        return "opened";
      } finally {
        switching.current = false;
      }
    },
    [commit, flush, leave, markMissing],
  );

  const add = useCallback(
    async (path: string) => {
      if (!(await leave.current())) return null;
      const result = addVault(configRef.current, path);
      if ("kind" in result) return result;
      flush.current(); // what was typed while it waited
      markMissing(path, false);
      commit(setActive(result.config, result.entry.path));
      return null;
    },
    [commit, flush, leave, markMissing],
  );

  const remove = useCallback(
    async (path: string): Promise<boolean> => {
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
        if (!(await leave.current())) return false;
        flush.current(); // what was typed while it waited
      }
      const rest = removeVault(configRef.current, path);
      commit(heir ? setActive(rest, heir) : rest);
      return true;
    },
    [commit, flush, leave],
  );

  const create = useCallback(
    async (name: string): Promise<CreateResult> => {
      const clean = name.trim();
      if (clean === "") return "empty";
      if (nameTaken(configRef.current.vaults, clean)) return "taken";
      if (switching.current) return "failed"; // a second tap while the first is still making it
      switching.current = true;
      try {
        if (!(await leave.current())) return "unsaved";
        const path = await makePrivateVaultFolder(nanoid());
        const result = addVault(configRef.current, path, clean);
        if ("kind" in result) return "failed"; // a folder of its own cannot overlap another vault
        flush.current(); // what was typed while it waited
        markMissing(path, false);
        commit(setActive(result.config, result.entry.path));
        return "created";
      } catch (err) {
        console.error("[vaults] could not make the vault:", err);
        return "failed";
      } finally {
        switching.current = false;
      }
    },
    [commit, flush, leave, markMissing],
  );

  const erase = useCallback(
    async (path: string): Promise<EraseResult> => {
      if (configRef.current.vaults.length <= 1) return "last";
      if (!(await remove(path))) return "unsaved";
      try {
        await deletePrivateVaultFolder(path);
        return "erased";
      } catch (err) {
        console.error("[vaults] could not delete the vault's files:", err);
        return "failed";
      }
    },
    [remove],
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

  const isMissing = useCallback(
    (path: string) => missing.has(pathKey(path)),
    [missing],
  );
  const active = findVault(config.vaults, config.active)?.path ?? null;

  // One object until something in it changes: it is a prop of the whole tree, and a new one on every render (the update
  // check alone changes App's state three times) would render it all again
  return useMemo(
    () => ({
      ready,
      corrupt,
      fellBack,
      vaults: config.vaults,
      active,
      isMissing,
      recheck,
      switchTo,
      add,
      remove,
      create,
      erase,
      rename,
      move,
      setShared: share,
    }),
    [
      ready,
      corrupt,
      fellBack,
      config.vaults,
      active,
      isMissing,
      recheck,
      switchTo,
      add,
      remove,
      create,
      erase,
      rename,
      move,
      share,
    ],
  );
}
