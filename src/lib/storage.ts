// src/lib/storage.ts
import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { Snippet } from "../types";

const FILE_PATH = "flowvault/snippets.json";
const DIR_PATH = "flowvault";

function isValidSnippet(item: unknown): item is Snippet {
  if (!item || typeof item !== "object") return false;
  const s = item as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    s.id.length > 0 &&
    typeof s.title === "string" &&
    s.title.length > 0 &&
    typeof s.code === "string" &&
    s.code.length > 0
  );
}

export async function loadSnippets(): Promise<Snippet[]> {
  try {
    const fileExists = await exists(FILE_PATH, {
      baseDir: BaseDirectory.AppData,
    });

    if (!fileExists) {
      await mkdir(DIR_PATH, {
        baseDir: BaseDirectory.AppData,
        recursive: true,
      });
      await writeTextFile(FILE_PATH, "[]", { baseDir: BaseDirectory.AppData });
      return [];
    }

    const raw = await readTextFile(FILE_PATH, {
      baseDir: BaseDirectory.AppData,
    });
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidSnippet);
  } catch (err) {
    console.error("[storage] loadSnippets failed:", err);
    return [];
  }
}

export async function saveSnippets(snippets: Snippet[]): Promise<void> {
  try {
    await writeTextFile(FILE_PATH, JSON.stringify(snippets, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  } catch (err) {
    console.error("[storage] saveSnippets failed:", err);
  }
}
