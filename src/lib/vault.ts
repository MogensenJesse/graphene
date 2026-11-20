// src/lib/vault.ts
import { open } from "@tauri-apps/plugin-dialog";
import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import {
  EMPTY_CONFIG,
  parseVaultConfig,
  serializeVaultConfig,
  type VaultConfig,
} from "./vaultList";

const CONFIG_DIR = "graphene";
const CONFIG_FILE = "graphene/config.json";
const CONFIG_TMP = "graphene/config.json.tmp";
const CONFIG_BACKUP = "graphene/config.json.bak";
const IN_APP_DATA = { baseDir: BaseDirectory.AppData };

/**
 * Reads config.json (see vaultList.ts for what is in it). No file is the first run: an empty list.
 * A file that cannot be read is kept as config.json.bak and reported, not mistaken for the first run, so the
 * list in it is not silently replaced.
 */
export async function loadVaultConfig(): Promise<{
  config: VaultConfig;
  corrupt: boolean;
}> {
  try {
    if (!(await exists(CONFIG_FILE, IN_APP_DATA)))
      return { config: EMPTY_CONFIG, corrupt: false };
  } catch {
    return { config: EMPTY_CONFIG, corrupt: false };
  }
  let raw = "";
  try {
    raw = await readTextFile(CONFIG_FILE, IN_APP_DATA);
    const json: unknown = JSON.parse(raw);
    if (typeof json === "object" && json !== null && !Array.isArray(json))
      return { config: parseVaultConfig(json), corrupt: false };
  } catch (err) {
    console.error("[vault] config.json cannot be read:", err);
  }
  try {
    await writeTextFile(CONFIG_BACKUP, raw, IN_APP_DATA);
  } catch {
    // no backup; the message still tells the person
  }
  return { config: EMPTY_CONFIG, corrupt: true };
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
