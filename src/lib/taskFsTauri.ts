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
import { requireRoot } from "./vaultRoot";

// One IPC call per step in the normal case (a call is a round trip through the webview): a file is read, not asked about
// first, and the folder is made only when a write finds it missing. Every plugin call is one IPC call; a change of a list is
// 3 (read, write the temp file, rename it), where it used to be 5, and reading a file that is there is 1, where it was 2.
export const tauriTaskFs: TaskFs = {
  async read(path) {
    try {
      return await readTextFile(path);
    } catch (err) {
      // Asked only after a failure: a file that is not there is null, but one that is there and cannot be read must throw
      // instead of reading as "missing" (the next change would write over it)
      if (await exists(path)) throw err;
      return null;
    }
  },
  async write(path, text) {
    const tmp = `${path}.tmp`;
    try {
      await writeTextFile(tmp, text);
    } catch {
      // The folder may not be there yet (the first change in a vault): make it and write again; any other failure fails again.
      // The vault's own folder is never made here: `recursive` would turn a vault that is gone into an empty new one
      const folder = path.slice(0, path.lastIndexOf("/"));
      await requireRoot(folder.slice(0, folder.lastIndexOf("/")));
      await mkdir(folder, { recursive: true });
      await writeTextFile(tmp, text);
    }
    await rename(tmp, path);
  },
  async remove(path) {
    try {
      await remove(path);
    } catch (err) {
      if (await exists(path)) throw err; // a file that is not there is not an error
    }
  },
};
