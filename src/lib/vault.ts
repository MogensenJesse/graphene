// src/lib/vault.ts
import { open } from "@tauri-apps/plugin-dialog";
import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";

const CONFIG_DIR = "graphene";
const CONFIG_FILE = "graphene/config.json";

interface VaultConfig {
  vaultPath: string;
}

async function ensureConfigDir(): Promise<void> {
  await mkdir(CONFIG_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
}

export async function getVaultPath(): Promise<string | null> {
  try {
    const fileExists = await exists(CONFIG_FILE, {
      baseDir: BaseDirectory.AppData,
    });
    if (!fileExists) return null;
    const raw = await readTextFile(CONFIG_FILE, {
      baseDir: BaseDirectory.AppData,
    });
    const parsed = JSON.parse(raw) as VaultConfig;
    return typeof parsed.vaultPath === "string" ? parsed.vaultPath : null;
  } catch {
    return null;
  }
}

export async function setVaultPath(path: string): Promise<void> {
  await ensureConfigDir();
  const config: VaultConfig = { vaultPath: path };
  await writeTextFile(CONFIG_FILE, JSON.stringify(config, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
}

export async function pickVaultPath(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  if (!selected) return null;
  return selected as string;
}
