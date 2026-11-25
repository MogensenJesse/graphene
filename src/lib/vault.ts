// src/lib/vault.ts
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  BaseDirectory,
  exists,
  mkdir,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import {
  EMPTY_CONFIG,
  parseVaultConfig,
  pathKey,
  serializeVaultConfig,
  type VaultConfig,
} from "./vaultList";

const CONFIG_DIR = "graphene";
const CONFIG_FILE = "graphene/config.json";
const CONFIG_TMP = "graphene/config.json.tmp";
const CONFIG_BACKUP = "graphene/config.json.bak";
const IN_APP_DATA = { baseDir: BaseDirectory.AppData };

/** What the Rust command `boot_config` (src-tauri/src/boot.rs) returns: the file's raw text, and whether each listed folder is there. */
interface BootConfig {
  /** null: there is no config.json (the first run) */
  text: string | null;
  /** By the path as written in the file; empty when the text is not JSON */
  exists: Record<string, boolean>;
}

/**
 * Reads config.json (see vaultList.ts for what is in it) with ONE call to Rust, which only reads: the file's text, and whether the
 * folder of each vault in it is there (`missing`, as pathKeys). All the meaning stays here. No file is the first run: an empty list.
 * A file that cannot be read is kept as config.json.bak (when its text could be read at all) and reported, not mistaken for the first
 * run, so the list in it is not silently replaced.
 */
export async function loadVaultConfig(): Promise<{
  config: VaultConfig;
  corrupt: boolean;
  missing: Set<string>;
}> {
  const unreadable = {
    config: EMPTY_CONFIG,
    corrupt: true,
    missing: new Set<string>(),
  };
  let boot: BootConfig;
  try {
    boot = await invoke<BootConfig>("boot_config");
  } catch (err) {
    // The file is there but cannot be read as text (or the command failed): nothing to copy
    console.error("[vault] config.json cannot be read:", err);
    return unreadable;
  }
  if (boot.text === null)
    return { config: EMPTY_CONFIG, corrupt: false, missing: new Set() };
  try {
    const json: unknown = JSON.parse(boot.text);
    if (typeof json === "object" && json !== null && !Array.isArray(json)) {
      const config = parseVaultConfig(json);
      // A folder Rust could not look at counts as missing, as in vaultFolderExists
      const gone = config.vaults.filter((v) => boot.exists[v.path] !== true);
      return {
        config,
        corrupt: false,
        missing: new Set(gone.map((v) => pathKey(v.path))),
      };
    }
  } catch (err) {
    console.error("[vault] config.json cannot be read:", err);
  }
  try {
    await writeTextFile(CONFIG_BACKUP, boot.text, IN_APP_DATA);
  } catch {
    // no backup; the message still tells the person
  }
  return unreadable;
}

// Saves go one after another in the order they were asked for, so a slow one cannot land after a newer one
let saving: Promise<void> = Promise.resolve();

/** Writes the whole config: to a temp file first, then renamed over, so a crash never leaves half a file. */
export function saveVaultConfig(config: VaultConfig): Promise<void> {
  const text = JSON.stringify(serializeVaultConfig(config), null, 2);
  const write = async () => {
    await mkdir(CONFIG_DIR, { ...IN_APP_DATA, recursive: true });
    await writeTextFile(CONFIG_TMP, text, IN_APP_DATA);
    await rename(CONFIG_TMP, CONFIG_FILE, {
      oldPathBaseDir: BaseDirectory.AppData,
      newPathBaseDir: BaseDirectory.AppData,
    });
  };
  const result = saving.then(write);
  saving = result.catch(() => undefined);
  return result;
}

/** Whether the vault's folder is there. One that cannot be looked at counts as missing. */
export async function vaultFolderExists(path: string): Promise<boolean> {
  try {
    return await exists(path);
  } catch {
    return false;
  }
}

export async function pickVaultPath(): Promise<string | null> {
  // `recursive` lets the app read the whole folder tree, not only the top of it
  const selected = await open({
    directory: true,
    multiple: false,
    recursive: true,
  });
  return typeof selected === "string" ? selected : null;
}
