// src/lib/storage.ts
import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { Folder, Item, SnippetItem } from "../types";

const DIR = "graphite";
const ITEMS_FILE = "graphite/items.json";
const FOLDERS_FILE = "graphite/folders.json";

// Legacy path — used only during one-time migration
const LEGACY_FILE = "flowvault/snippets.json";

function isValidItem(item: unknown): item is Item {
  if (!item || typeof item !== "object") return false;
  const s = item as Record<string, unknown>;
  if (
    typeof s.id !== "string" ||
    s.id.length === 0 ||
    typeof s.title !== "string"
  )
    return false;
  if (s.type === "note") return typeof s.body === "string";
  if (s.type === "snippet")
    return typeof s.code === "string" && typeof s.lang === "string";
  return false;
}

function isValidFolder(f: unknown): f is Folder {
  if (!f || typeof f !== "object") return false;
  const o = f as Record<string, unknown>;
  return (
    typeof o.id === "string" && o.id.length > 0 && typeof o.name === "string"
  );
}

interface LegacySnippet {
  id: string;
  title: string;
  lang: string;
  projects?: string[];
  code: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  copies: number;
}

function isLegacySnippet(item: unknown): item is LegacySnippet {
  if (!item || typeof item !== "object") return false;
  const s = item as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    s.id.length > 0 &&
    typeof s.title === "string" &&
    s.title.length > 0 &&
    typeof s.code === "string"
  );
}

function migrateSnippet(s: LegacySnippet): SnippetItem {
  return {
    id: s.id,
    type: "snippet",
    title: s.title,
    folderId: null,
    createdAt: s.createdAt ?? new Date().toISOString(),
    updatedAt: s.updatedAt ?? new Date().toISOString(),
    lang: (s.lang as SnippetItem["lang"]) ?? "JS",
    code: s.code,
    note: s.note ?? "",
    copies: typeof s.copies === "number" ? s.copies : 0,
  };
}

async function ensureDir(): Promise<void> {
  await mkdir(DIR, { baseDir: BaseDirectory.AppData, recursive: true });
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function loadItems(): Promise<Item[]> {
  try {
    const itemsExist = await exists(ITEMS_FILE, {
      baseDir: BaseDirectory.AppData,
    });

    if (itemsExist) {
      const raw = await readTextFile(ITEMS_FILE, {
        baseDir: BaseDirectory.AppData,
      });
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidItem);
    }

    // Migration: try reading legacy snippets.json
    const legacyExists = await exists(LEGACY_FILE, {
      baseDir: BaseDirectory.AppData,
    });
    await ensureDir();

    if (legacyExists) {
      try {
        const raw = await readTextFile(LEGACY_FILE, {
          baseDir: BaseDirectory.AppData,
        });
        const parsed = JSON.parse(raw) as unknown;
        const migrated: Item[] = Array.isArray(parsed)
          ? parsed.filter(isLegacySnippet).map(migrateSnippet)
          : [];
        await writeTextFile(ITEMS_FILE, JSON.stringify(migrated, null, 2), {
          baseDir: BaseDirectory.AppData,
        });
        // Write empty folders file if it doesn't exist yet
        const foldersExist = await exists(FOLDERS_FILE, {
          baseDir: BaseDirectory.AppData,
        });
        if (!foldersExist) {
          await writeTextFile(FOLDERS_FILE, "[]", {
            baseDir: BaseDirectory.AppData,
          });
        }
        return migrated;
      } catch (migrationErr) {
        console.warn(
          "[storage] migration failed, starting fresh:",
          migrationErr,
        );
      }
    }

    // Fresh start
    await writeTextFile(ITEMS_FILE, "[]", { baseDir: BaseDirectory.AppData });
    return [];
  } catch (err) {
    console.error("[storage] loadItems failed:", err);
    return [];
  }
}

export async function saveItems(items: Item[]): Promise<void> {
  try {
    await ensureDir();
    await writeTextFile(ITEMS_FILE, JSON.stringify(items, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  } catch (err) {
    console.error("[storage] saveItems failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function loadFolders(): Promise<Folder[]> {
  try {
    const fileExists = await exists(FOLDERS_FILE, {
      baseDir: BaseDirectory.AppData,
    });
    if (!fileExists) {
      await ensureDir();
      await writeTextFile(FOLDERS_FILE, "[]", {
        baseDir: BaseDirectory.AppData,
      });
      return [];
    }
    const raw = await readTextFile(FOLDERS_FILE, {
      baseDir: BaseDirectory.AppData,
    });
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidFolder);
  } catch (err) {
    console.error("[storage] loadFolders failed:", err);
    return [];
  }
}

export async function saveFolders(folders: Folder[]): Promise<void> {
  try {
    await ensureDir();
    await writeTextFile(FOLDERS_FILE, JSON.stringify(folders, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  } catch (err) {
    console.error("[storage] saveFolders failed:", err);
  }
}
