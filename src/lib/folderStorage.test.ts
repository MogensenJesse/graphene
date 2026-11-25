// src/lib/folderStorage.test.ts
// Deleting a folder, undoing it, and moving a folder under another one, over an in-memory stand-in for Tauri's fs plugin in which
// renaming a directory moves everything in it. (storage.test.ts has the stand-in for the note writes.)
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const fs = vi.hoisted(() => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const state = { fail: (_op: string, _path: string) => false };
  const under = (p: string, dir: string) => p.startsWith(`${dir}/`);
  const check = (op: string, path: string) => {
    if (state.fail(op, path)) throw new Error(`${op} failed`);
  };
  return {
    files,
    dirs,
    state,
    async exists(p: string) {
      return files.has(p) || dirs.has(p);
    },
    async mkdir(p: string) {
      check("mkdir", p);
      // recursive: every parent too
      for (let at = p.indexOf("/", 1); at !== -1; at = p.indexOf("/", at + 1))
        dirs.add(p.slice(0, at));
      dirs.add(p);
    },
    async writeTextFile(p: string, text: string) {
      files.set(p, text);
    },
    async readTextFile(p: string) {
      const t = files.get(p);
      if (t === undefined) throw new Error("no such file");
      return t;
    },
    async rename(from: string, to: string) {
      check("rename", `${from} -> ${to}`);
      if (files.has(from)) {
        files.set(to, files.get(from) ?? "");
        files.delete(from);
      } else if (dirs.has(from)) {
        if (dirs.has(to) || files.has(to)) throw new Error("exists");
        for (const d of [...dirs])
          if (d === from || under(d, from)) {
            dirs.delete(d);
            dirs.add(to + d.slice(from.length));
          }
        for (const [p, text] of [...files])
          if (under(p, from)) {
            files.delete(p);
            files.set(to + p.slice(from.length), text);
          }
      } else throw new Error("no such file");
    },
    async remove(p: string) {
      files.delete(p);
    },
    async readDir() {
      return [];
    },
  };
});
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: fs.exists,
  mkdir: fs.mkdir,
  readDir: fs.readDir,
  readTextFile: fs.readTextFile,
  remove: fs.remove,
  rename: fs.rename,
  writeTextFile: fs.writeTextFile,
}));

const storage = await import("./storage");
const V = "/v";

beforeEach(() => {
  fs.files.clear();
  fs.dirs.clear();
  fs.dirs.add(V);
  fs.state.fail = () => false;
});

/** A folder Work > Plans on disk, with a note out of Graphene's sight (a picture) in each. */
function layout() {
  fs.dirs.add("/v/Work");
  fs.dirs.add("/v/Work/Plans");
  fs.files.set("/v/Work/logo.png", "png");
  fs.files.set("/v/Work/Plans/sketch.png", "sketch");
}

test("deleting a folder gives where it went in .trash, and the whole directory is there, files Graphene does not know included", async () => {
  layout();
  const at = await storage.deleteFolderDir(V, "Work");
  assert.equal(at, "/v/.trash/Work");
  assert.equal(fs.dirs.has("/v/Work"), false);
  assert.equal(fs.files.get("/v/.trash/Work/logo.png"), "png");
  assert.equal(fs.files.get("/v/.trash/Work/Plans/sketch.png"), "sketch");
  // a folder that is not on the disk has nothing to move
  assert.equal(await storage.deleteFolderDir(V, "Nope"), null);
});

test("a second folder of the same name in the trash does not overwrite the first", async () => {
  fs.dirs.add("/v/.trash");
  fs.dirs.add("/v/.trash/Work");
  fs.files.set("/v/.trash/Work/old.png", "old");
  fs.dirs.add("/v/Work");
  const at = await storage.deleteFolderDir(V, "Work");
  assert.ok(at && at !== "/v/.trash/Work" && at.endsWith("-Work"));
  assert.equal(fs.files.get("/v/.trash/Work/old.png"), "old");
});

test("undo brings the directory back from the trash with everything in it, and makes the folders that were not on the disk", async () => {
  layout();
  const at = await storage.deleteFolderDir(V, "Work");
  await storage.restoreFolderDir(V, ["Work", "Work/Plans", "Work/Misc"], at);
  assert.equal(fs.files.get("/v/Work/logo.png"), "png");
  assert.equal(fs.files.get("/v/Work/Plans/sketch.png"), "sketch");
  assert.ok(fs.dirs.has("/v/Work/Plans"));
  assert.ok(fs.dirs.has("/v/Work/Misc"));
  assert.equal(fs.dirs.has("/v/.trash/Work"), false);
});

test("undo of a folder that had no directory only makes the folders", async () => {
  await storage.restoreFolderDir(V, ["Work", "Work/Plans"], null);
  assert.ok(fs.dirs.has("/v/Work/Plans"));
});

test("undo is refused, with nothing changed, when something sits where the folder was", async () => {
  layout();
  const at = await storage.deleteFolderDir(V, "Work");
  fs.dirs.add("/v/Work");
  await assert.rejects(
    storage.restoreFolderDir(V, ["Work"], at),
    /exists again/,
  );
  assert.equal(fs.files.get("/v/.trash/Work/logo.png"), "png");
  assert.equal(fs.dirs.has("/v/Work/Plans"), false);
});

test("undo rejects when the move back fails, and leaves the trash copy where it is", async () => {
  layout();
  const at = await storage.deleteFolderDir(V, "Work");
  fs.state.fail = (op) => op === "rename";
  await assert.rejects(
    storage.restoreFolderDir(V, ["Work", "Work/Plans"], at),
    /rename failed/,
  );
  assert.equal(fs.files.get("/v/.trash/Work/logo.png"), "png");
  assert.equal(fs.dirs.has("/v/Work"), false);
});

test("a folder moved under another parent takes its files with it; a rename stays in place", async () => {
  layout();
  fs.dirs.add("/v/Home");
  await storage.moveFolderDir(V, "Work/Plans", "Home/Plans");
  assert.equal(fs.files.get("/v/Home/Plans/sketch.png"), "sketch");
  assert.equal(fs.dirs.has("/v/Work/Plans"), false);
  assert.ok(fs.files.has("/v/Work/logo.png"));
  await storage.renameFolderDir(V, "Home/Plans", "Ideas");
  assert.equal(fs.files.get("/v/Home/Ideas/sketch.png"), "sketch");
  // to the vault root
  await storage.moveFolderDir(V, "Home/Ideas", "Ideas");
  assert.equal(fs.files.get("/v/Ideas/sketch.png"), "sketch");
});

test("a move onto a directory that exists is refused and nothing moves", async () => {
  layout();
  fs.dirs.add("/v/Home");
  fs.dirs.add("/v/Home/Plans");
  await assert.rejects(
    storage.moveFolderDir(V, "Work/Plans", "Home/Plans"),
    /exists/,
  );
  assert.equal(fs.files.get("/v/Work/Plans/sketch.png"), "sketch");
});
