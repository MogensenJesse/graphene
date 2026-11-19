// mcp/vault.ts
// The vault as the MCP server sees it: scan, read and write notes on disk with node:fs. The app does the same through
// Tauri's fs plugin in src/lib/storage.ts; keep the scan rules (what is skipped, where a note's folder comes from) in step.
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname } from "node:path";
import { ATTACH_DIR } from "../src/lib/attachments";
import { parseNoteFile, serializeItem } from "../src/lib/fileFormat";
import { joinPath, relativePath } from "../src/lib/paths";
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

/** Writes a temp file next to the note and renames it over, so a crash never leaves half a note (the scan skips dot files). */
export async function writeNote(path: string, item: Item): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const tmp = joinPath(dir, `.${basename(path)}.tmp`);
  await writeFile(tmp, serializeItem(item));
  await rename(tmp, path);
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

/** `--vault <folder>`, then GRAPHENE_VAULT, then the folder the app saved in its config (see src/lib/vault.ts). */
export async function resolveVaultPath(
  argv: string[],
  env: NodeJS.ProcessEnv,
): Promise<string> {
  const at = argv.indexOf("--vault");
  const given =
    (at >= 0 ? argv[at + 1] : undefined) ??
    argv.find((a) => a.startsWith("--vault="))?.slice("--vault=".length) ??
    envValue(env.GRAPHENE_VAULT);
  if (given) return joinPath(given);

  const config = joinPath(
    appDataDir(env),
    "com.graphene.app",
    "graphene",
    "config.json",
  );
  try {
    const { vaultPath } = JSON.parse(await readFile(config, "utf8"));
    if (typeof vaultPath === "string") return joinPath(vaultPath);
  } catch {
    // fall through to the error below
  }
  throw new Error(
    "No vault found. Open Graphene once and choose a vault, or pass --vault <folder> (or set GRAPHENE_VAULT).",
  );
}
