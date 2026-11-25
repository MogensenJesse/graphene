// mcp/vault.ts
// The vault as the MCP server sees it: scan, read and write notes on disk with node:fs. The app does the same through
// Tauri's fs plugin in src/lib/storage.ts; keep the scan rules (what is skipped, where a note's folder comes from) in step.
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { type AtomicFs, writeAtomic } from "../src/lib/atomicWrite";
import { ATTACH_DIR } from "../src/lib/attachments";
import { parseNoteFile, serializeItem } from "../src/lib/fileFormat";
import { joinPath, relativePath } from "../src/lib/paths";
import {
  folderName,
  parseVaultConfig,
  pathKey,
  sharedVaults,
  type VaultConfig,
} from "../src/lib/vaultList";
import type { Item } from "../src/types";

/** A note and the file it was read from (which is not always the name the app would give it). */
export interface Note {
  item: Item;
  path: string;
}

async function loadNote(vault: string, path: string): Promise<Note | null> {
  let parsed: Item;
  try {
    parsed = parseNoteFile(await readFile(path, "utf8"));
  } catch {
    return null; // like the app: a file that cannot be read is not a note
  }
  if (!parsed.id) return null;
  // The folder a note sits in wins over the one its frontmatter remembers
  const rel = relativePath(vault, path);
  const slash = rel.lastIndexOf("/");
  return {
    item: {
      ...parsed,
      folderId: slash < 0 ? parsed.folderId : rel.slice(0, slash),
    },
    path,
  };
}

/** Every note and folder of the vault. Dot entries (.trash, .git) and the root attachments folder are not content. */
export async function scanVault(
  vault: string,
): Promise<{ notes: Note[]; folders: string[] }> {
  const notes = new Map<string, Note>();
  const folders: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (
        entry.isDirectory() &&
        dir === vault &&
        entry.name.toLowerCase() === ATTACH_DIR
      )
        continue;
      const path = joinPath(dir, entry.name);
      if (entry.isDirectory()) {
        folders.push(relativePath(vault, path));
        await walk(path);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const note = await loadNote(vault, path);
        if (note) notes.set(note.item.id, note); // two files with one id: the last wins, as in the app
      }
    }
  };
  try {
    await walk(vault);
  } catch (err) {
    throw new Error(
      `Cannot read the vault folder "${vault}": ${err instanceof Error ? err.message : err}`,
    );
  }
  return { notes: [...notes.values()], folders };
}

const nodeFs: AtomicFs = {
  writeText: (path, text) => writeFile(path, text),
  rename,
  remove: (path) => rm(path, { force: true }),
};

/**
 * The error of a write into a vault whose folder is not there (renamed, deleted, a drive disconnected). A recursive `mkdir` would make
 * the folder again, as an empty vault with the note in it, so the writes check first (src/lib/vaultRoot.ts does the same in the app).
 */
export const vaultMissingError = (vault: string): Error =>
  new Error(
    `Nothing was written: the vault folder is not there ("${vault}"). Check that it was not renamed and that its drive is connected.`,
  );

/** Rejects with `vaultMissingError` unless the vault folder itself exists. */
export async function requireVault(vault: string): Promise<void> {
  let there = false;
  try {
    there = (await stat(vault)).isDirectory();
  } catch {
    // a folder that cannot be looked at counts as missing
  }
  if (!there) throw vaultMissingError(vault);
}

/**
 * Writes the note through a temp file next to it (src/lib/atomicWrite, the same helper as the app), so a crash never leaves half a note; the scan skips dot files.
 * The folders below the vault that it sits in are made as needed; the vault's own folder is never made (`requireVault`).
 */
export async function writeNote(
  vault: string,
  path: string,
  item: Item,
): Promise<void> {
  await requireVault(vault);
  await mkdir(dirname(path), { recursive: true });
  await writeAtomic(nodeFs, path, serializeItem(item));
}

function appDataDir(env: NodeJS.ProcessEnv): string {
  if (env.APPDATA) return env.APPDATA;
  if (process.platform === "darwin")
    return joinPath(homedir(), "Library/Application Support");
  return env.XDG_DATA_HOME ?? joinPath(homedir(), ".local/share");
}

/** An env value a client left empty, or as the "${user_config.…}" placeholder it never filled in, is no value. */
const envValue = (value: string | undefined) =>
  value && !value.includes("${") ? value : undefined;

/** A vault the assistant can name */
export interface VaultRef {
  name: string;
  path: string;
}

/** The vaults shared with assistants right now, and the name of the one open in Graphene (null when it is not shared). */
export interface VaultView {
  vaults: VaultRef[];
  active: string | null;
}

/** Asked on every tool call, so a vault added, renamed or unshared in Graphene applies without restarting the assistant. */
export type VaultSource = () => Promise<VaultView>;

const NO_VAULT =
  "No vault found. Open Graphene once and choose a vault, or pass --vault <folder> (or set GRAPHENE_VAULT).";

/** One folder, whatever it is called, as the only vault (the flag, the env variable, tests). */
export function singleVault(path: string): VaultSource {
  const clean = joinPath(path);
  const name = folderName(clean);
  const view = { vaults: [{ name, path: clean }], active: name };
  return async () => view;
}

/**
 * The vaults in the app's config (see src/lib/vaultList.ts), those it shares. If the file cannot be read for a moment
 * the list from the last good read stays in use.
 */
export function configVaults(env: NodeJS.ProcessEnv): VaultSource {
  const file = joinPath(
    appDataDir(env),
    "com.graphene.app",
    "graphene",
    "config.json",
  );
  let lastGood: VaultView | null = null;
  return async () => {
    let config: VaultConfig;
    try {
      config = parseVaultConfig(JSON.parse(await readFile(file, "utf8")));
    } catch {
      if (!lastGood) throw new Error(NO_VAULT);
      return lastGood;
    }
    // Graphene has never had a vault chosen: that is the "open Graphene once" case, not "nothing is shared"
    if (config.vaults.length === 0 && !lastGood) throw new Error(NO_VAULT);
    const vaults = sharedVaults(config).map(({ name, path }) => ({
      name,
      path: joinPath(path),
    }));
    const open = vaults.find(
      (v) =>
        config.active !== null && pathKey(v.path) === pathKey(config.active),
    );
    lastGood = { vaults, active: open?.name ?? vaults[0]?.name ?? null };
    return lastGood;
  };
}

/** `--vault <folder>` or GRAPHENE_VAULT pin one vault; otherwise the vaults Graphene shares. */
export function vaultSource(
  argv: string[],
  env: NodeJS.ProcessEnv,
): VaultSource {
  const at = argv.indexOf("--vault");
  const given =
    (at >= 0 ? argv[at + 1] : undefined) ??
    argv.find((a) => a.startsWith("--vault="))?.slice("--vault=".length) ??
    envValue(env.GRAPHENE_VAULT);
  return given ? singleVault(given) : configVaults(env);
}
