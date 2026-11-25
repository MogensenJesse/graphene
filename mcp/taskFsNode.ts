// mcp/taskFsNode.ts
// The MCP server's side of src/lib/taskFiles: node's file system.
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TaskFs } from "../src/lib/taskFiles";
import { vaultMissingError } from "./vault";

/**
 * Makes the `.tasks` folder, and only that: `mkdir` without `recursive` fails when the vault folder above it is not there, which is
 * then reported as such, instead of making the whole vault again as an empty folder with a task file in it.
 */
async function makeTasksDir(dir: string): Promise<void> {
  try {
    await mkdir(dir);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EEXIST") return;
    if (code === "ENOENT") throw vaultMissingError(dirname(dir));
    throw e;
  }
}

export const nodeTaskFs: TaskFs = {
  async read(path) {
    try {
      return await readFile(path, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  },
  async write(path, text) {
    await makeTasksDir(dirname(path));
    const tmp = `${path}.tmp`;
    await writeFile(tmp, text);
    await rename(tmp, path);
  },
  async remove(path) {
    await rm(path, { force: true });
  },
};
