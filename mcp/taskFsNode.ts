// mcp/taskFsNode.ts
// The MCP server's side of src/lib/taskFiles: node's file system.
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TaskFs } from "../src/lib/taskFiles";

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
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    await writeFile(tmp, text);
    await rename(tmp, path);
  },
  async remove(path) {
    await rm(path, { force: true });
  },
};
