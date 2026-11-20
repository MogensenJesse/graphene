// src/lib/taskFsTauri.ts
// The app's side of taskFiles: Tauri's file plugin.
import {
  exists,
  mkdir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { TaskFs } from "./taskFiles";

export const tauriTaskFs: TaskFs = {
  async read(path) {
    // Checked first, so a file that exists but cannot be read throws instead of reading as "missing"
    return (await exists(path)) ? readTextFile(path) : null;
  },
  async write(path, text) {
    const dir = path.slice(0, path.lastIndexOf("/"));
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });
    const tmp = `${path}.tmp`;
    await writeTextFile(tmp, text);
    await rename(tmp, path);
  },
  async remove(path) {
    if (await exists(path)) await remove(path);
  },
};
