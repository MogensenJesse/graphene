// src/lib/atomicWrite.ts
// Replaces a file whole: the text goes to a temp file next to it, which is then renamed over it, so a crash or a
// failed write never leaves half a note and the old file stays until the new one is complete. Over a tiny fs
// interface so the app (Tauri's fs plugin) and the MCP server (node:fs) share it, like TaskFs in taskFiles.ts.
import { fileName } from "./paths";

export interface AtomicFs {
  writeText(path: string, text: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/**
 * The temp file of `path` (which uses "/"): a dot file in the same folder, so the vault scans, which skip dot
 * entries and anything that is not .md, can never show a leftover as a note.
 */
export function tempPathFor(path: string): string {
  const name = fileName(path);
  return `${path.slice(0, path.length - name.length)}.${name}.tmp`;
}

/** Writes `text` to `path` through a temp file. On failure the temp file is removed and `path` is untouched; rejects. */
export async function writeAtomic(
  fs: AtomicFs,
  path: string,
  text: string,
): Promise<void> {
  const tmp = tempPathFor(path);
  try {
    await fs.writeText(tmp, text);
    await fs.rename(tmp, path);
  } catch (err) {
    // The temp file may not exist (the write itself failed); only the original error matters
    await fs.remove(tmp).catch(() => {});
    throw err;
  }
}
