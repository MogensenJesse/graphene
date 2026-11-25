// src/lib/storage.test.ts
// The write contract of storage.ts (see its header), over an in-memory stand-in for Tauri's fs plugin; the scan (Rust) is a stub.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import type { Item } from "../types";

const fs = vi.hoisted(() => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const log: string[] = [];
  const state = {
    /** True makes that operation on that path throw, like a full disk or a locked file. */
    fail: (_op: string, _path: string) => false,
    /** Milliseconds a rename takes, to see which writes wait for it. */
    renameDelay: 0,
  };
  const name = (p: string) => p.slice(p.lastIndexOf("/") + 1);
  const parent = (p: string) => p.slice(0, p.lastIndexOf("/"));
  const check = (op: string, path: string) => {
    log.push(`${op} ${path}`);
    if (state.fail(op, path)) throw new Error(`${op} failed`);
  };
  return {
    files,
    dirs,
    log,
    state,
    async exists(p: string) {
      return files.has(p) || dirs.has(p);
    },
    async mkdir(p: string) {
      check("mkdir", p);
      dirs.add(p);
    },
    async writeTextFile(p: string, text: string) {
      check("write", p);
      if (!dirs.has(parent(p))) throw new Error("no such folder"); // like the OS: a file needs its folder
      files.set(p, text);
    },
    async readTextFile(p: string) {
      const text = files.get(p);
      if (text === undefined) throw new Error("no such file");
      return text;
    },
    async rename(from: string, to: string) {
      check("rename", `${from} -> ${to}`);
      if (state.renameDelay)
        await new Promise((r) => setTimeout(r, state.renameDelay));
      log.push(`renamed ${from}`);
      const text = files.get(from);
      if (text !== undefined) {
        files.delete(from);
        files.set(to, text);
      } else if (dirs.delete(from)) dirs.add(to);
      else throw new Error("no such file");
    },
    async remove(p: string) {
      check("remove", p);
      if (!files.delete(p)) throw new Error("no such file");
    },
    async readDir(dir: string) {
      if (!dirs.has(dir)) throw new Error("no such folder");
      return [
        ...[...files.keys()]
          .filter((p) => parent(p) === dir)
          .map((p) => ({ name: name(p), isFile: true, isDirectory: false })),
        ...[...dirs]
          .filter((p) => parent(p) === dir)
          .map((p) => ({ name: name(p), isFile: false, isDirectory: true })),
      ];
    },
  };
});

// The Rust commands: scan_vault and read_notes
const core = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: core.invoke }));

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: fs.exists,
  mkdir: fs.mkdir,
  readDir: fs.readDir,
  readTextFile: fs.readTextFile,
  remove: fs.remove,
  rename: fs.rename,
  writeTextFile: fs.writeTextFile,
}));

// Imported after the mock is registered
const storage = await import("./storage");
const { serializeItem } = await import("./fileFormat");
const { rootLost } = await import("./vaultRoot");

const V = "/v";
const item = (over: Partial<Item> = {}): Item => ({
  id: "n1",
  title: "Plan",
  folderId: null,
  body: "text",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

beforeEach(() => {
  fs.files.clear();
  fs.dirs.clear();
  fs.dirs.add(V);
  fs.log.length = 0;
  fs.state.fail = () => false;
  fs.state.renameDelay = 0;
  core.invoke.mockReset();
});
afterEach(() => vi.restoreAllMocks());

/** Puts a note on the fake disk as the app would have saved it. */
function put(path: string, i: Item) {
  fs.files.set(path, serializeItem(i));
}
const names = () => [...fs.files.keys()].sort();

test("a failed write rejects and leaves the old note and no temp file", async () => {
  put("/v/plan-n1.md", item());
  fs.state.fail = (op, path) => op === "write" && path.endsWith(".tmp");
  await assert.rejects(
    storage.replaceItemFile(V, item(), item({ title: "Roadmap" })),
    /write failed/,
  );
  assert.deepEqual(names(), ["/v/plan-n1.md"]);
  assert.match(fs.files.get("/v/plan-n1.md") ?? "", /text/);
});

test("a renamed note is written under its new name before the old file goes", async () => {
  put("/v/plan-n1.md", item());
  await storage.replaceItemFile(V, item(), item({ title: "Roadmap" }));
  assert.deepEqual(names(), ["/v/roadmap-n1.md"]);
  const at = (prefix: string) => fs.log.findIndex((l) => l.startsWith(prefix));
  assert.ok(at("rename /v/.roadmap-n1.md.tmp") < at("remove /v/plan-n1.md"));
});

test("when the old file cannot be removed the save stands and only warns", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  put("/v/plan-n1.md", item());
  fs.state.fail = (op, path) => op === "remove" && path === "/v/plan-n1.md";
  await storage.replaceItemFile(V, item(), item({ title: "Roadmap" }));
  assert.deepEqual(names(), ["/v/plan-n1.md", "/v/roadmap-n1.md"]);
  assert.equal(warn.mock.calls.length, 1);
});

test("paths that differ only in case are never removed (a folder renamed Work to work)", async () => {
  put("/v/Work/plan-n1.md", item({ folderId: "Work" }));
  await storage.replaceItemFile(
    V,
    item({ folderId: "Work" }),
    item({ folderId: "work" }),
  );
  assert.ok(!fs.log.some((l) => l.startsWith("remove")));
});

test("saveItem rejects when the write fails and leaves nothing behind", async () => {
  fs.state.fail = (op) => op === "write";
  await assert.rejects(storage.saveItem(V, item()), /write failed/);
  assert.deepEqual(names(), []);
});

test("trashing and moving reject when the file cannot be moved, and are no-ops for a note that is not there", async () => {
  await storage.trashItemFile(V, item());
  await storage.moveItemFile(V, item(), "a");
  put("/v/plan-n1.md", item());
  fs.state.fail = (op) => op === "rename";
  await assert.rejects(storage.trashItemFile(V, item()), /rename failed/);
  await assert.rejects(storage.moveItemFile(V, item(), "a"), /rename failed/);
  assert.deepEqual(names(), ["/v/plan-n1.md"]);
});

test("deleting a folder rejects when it cannot go to the trash", async () => {
  fs.dirs.add("/v/old");
  fs.state.fail = (op) => op === "rename";
  await assert.rejects(storage.deleteFolderDir(V, "old"), /rename failed/);
});

test("emptying the trash tries every file and rejects when one stays", async () => {
  put("/v/.trash/plan-n1.md", item());
  put("/v/.trash/plan-n2.md", item({ id: "n2" }));
  fs.state.fail = (op, path) => op === "remove" && path.endsWith("n1.md");
  await assert.rejects(
    storage.emptyTrashFiles(V, [item(), item({ id: "n2" })]),
    /remove failed/,
  );
  assert.deepEqual(names(), ["/v/.trash/plan-n1.md"]);
});

test("deleting one note for good removes only its file, and a file that stays rejects and is still there", async () => {
  put("/v/.trash/plan-n1.md", item());
  put("/v/.trash/plan-n2.md", item({ id: "n2" }));
  fs.state.fail = (op) => op === "remove";
  await assert.rejects(storage.emptyTrashFiles(V, [item()]), /remove failed/);
  assert.deepEqual(names(), ["/v/.trash/plan-n1.md", "/v/.trash/plan-n2.md"]);
  fs.state.fail = () => false;
  await storage.emptyTrashFiles(V, [item()]);
  assert.deepEqual(names(), ["/v/.trash/plan-n2.md"]);
  await storage.emptyTrashFiles(V, [item()]); // already gone: not a failure
});

test("restoring rejects when the write fails and keeps the trash copy; a stuck trash copy only warns", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  put("/v/.trash/plan-n1.md", item());
  fs.state.fail = (op, path) => op === "write" && path.endsWith(".tmp");
  await assert.rejects(storage.restoreItemFile(V, item()), /write failed/);
  assert.deepEqual(names(), ["/v/.trash/plan-n1.md"]);

  fs.state.fail = (op) => op === "remove";
  const restored = await storage.restoreItemFile(V, item());
  assert.equal(restored.folderId, null);
  assert.deepEqual(names(), ["/v/.trash/plan-n1.md", "/v/plan-n1.md"]);
  assert.equal(warn.mock.calls.length, 1);
});

test("writes run in the order they were asked for, and a failed one does not block the next", async () => {
  fs.dirs.add("/v/a");
  put("/v/a/plan-n1.md", item({ folderId: "a" }));
  fs.state.renameDelay = 10;
  const rename = storage.renameFolderDir(V, "a", "b");
  const save = storage.saveItem(V, item({ id: "n2", folderId: "b" }));
  await Promise.all([rename, save]);
  // The folder is renamed before the note is written into it, not beside the rename
  assert.ok(fs.log.indexOf("renamed /v/a") < fs.log.indexOf("mkdir /v/b"));

  fs.state.fail = (op) => op === "mkdir";
  await assert.rejects(storage.createFolderDir(V, folder("c")), /mkdir failed/);
  fs.state.fail = () => false;
  await storage.saveItem(V, item({ id: "n3" }));
  assert.ok(fs.files.has("/v/plan-n3.md"));
});

/** What scan_vault answers for one note. */
const scannedNote = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: id,
  folderId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  kind: "note",
  path: `${id}.md`,
  mtimeMs: 5,
  size: 7,
  ...over,
});

test("loadVault lists every note without its text, with the file each came from and the size of the trash", async () => {
  core.invoke.mockResolvedValue({
    notes: [
      scannedNote("n1", { kind: "code", path: "w/n1.md" }),
      scannedNote("n2"),
    ],
    folders: [{ id: "w", name: "w", parentId: null }],
    trashCount: 3,
  });
  const load = await storage.loadVault(V);
  assert.deepEqual(core.invoke.mock.calls, [["scan_vault", { path: V }]]); // one call, no file read
  assert.equal(fs.log.length, 0);
  assert.deepEqual(
    load.items.map((i) => [i.id, i.body, i.unloaded]),
    [
      ["n1", "", { kind: "code" }],
      ["n2", "", { kind: "note" }],
    ],
  );
  assert.deepEqual(load.files.get("n1"), {
    path: "w/n1.md",
    mtimeMs: 5,
    size: 7,
  });
  assert.equal(load.trashCount, 3);
  assert.equal(load.folders[0].id, "w");
});

test("a vault that cannot be scanned rejects with an Error, never as an empty vault", async () => {
  core.invoke.mockRejectedValue("/v: cannot read the vault folder"); // invoke rejects with a string
  await assert.rejects(storage.loadVault(V), /cannot read the vault folder/);
  await assert.rejects(storage.loadVault(V), (e) => e instanceof Error);
  core.invoke.mockRejectedValue("gone");
  await assert.rejects(storage.rescanVault(V, new Map(), new Set()), Error);
});

test("a rescan reads only the notes that are new or whose file changed", async () => {
  core.invoke.mockImplementation(
    async (cmd: string, args: { paths?: string[] }) =>
      cmd === "scan_vault"
        ? {
            notes: [
              scannedNote("same"),
              scannedNote("touched", { mtimeMs: 9 }),
              scannedNote("fresh"),
            ],
            folders: [],
            trashCount: 0,
          }
        : (args.paths ?? []).map((p) => ({ text: `text of ${p}` })),
  );
  const known = new Map([
    ["same", { path: "same.md", mtimeMs: 5, size: 7 }],
    ["touched", { path: "touched.md", mtimeMs: 5, size: 7 }],
  ]);
  const scan = await storage.rescanVault(
    V,
    known,
    new Set(["same", "touched"]),
  );
  const reads = core.invoke.mock.calls.filter(([cmd]) => cmd === "read_notes");
  assert.deepEqual(
    reads.map(([, args]) => args.paths),
    [["/v/touched.md", "/v/fresh.md"]],
  );
  assert.deepEqual([...scan.read], ["touched", "fresh"]);
  assert.deepEqual(
    [...scan.bodies],
    [
      ["touched", "text of /v/touched.md"],
      ["fresh", "text of /v/fresh.md"],
    ],
  );
  assert.equal(scan.notes.length, 3);
});

test("a note whose text has not been read is never written: every write refuses it and the file stays as it was", async () => {
  put("/v/plan-n1.md", item());
  const waiting = item({ body: "", unloaded: { kind: "note" } });
  const before = fs.files.get("/v/plan-n1.md");
  await assert.rejects(storage.saveItem(V, waiting), /not been read/);
  await assert.rejects(
    storage.replaceItemFile(V, item(), { ...waiting, title: "Roadmap" }),
    /not been read/,
  );
  await assert.rejects(storage.restoreItemFile(V, waiting), /not been read/);
  // the note is as it was: not replaced by an empty one, no new file, no temp file, nothing removed
  assert.equal(fs.files.get("/v/plan-n1.md"), before);
  assert.deepEqual(names(), ["/v/plan-n1.md"]);
  assert.ok(
    !fs.log.some((l) => l.startsWith("write") || l.startsWith("remove")),
  );
  // and the queue is not stuck: a loaded note is written next
  await storage.saveItem(V, item({ id: "n2", title: "Other" }));
  assert.ok(fs.files.has("/v/other-n2.md"));
});

test("moving or trashing a note that is not loaded only renames its file, so the text on disk is untouched", async () => {
  put("/v/plan-n1.md", item());
  const before = fs.files.get("/v/plan-n1.md");
  const waiting = item({ body: "", unloaded: { kind: "note" } });
  await storage.moveItemFile(V, waiting, "a");
  assert.equal(fs.files.get("/v/a/plan-n1.md"), before);
  await storage.trashItemFile(V, { ...waiting, folderId: "a" });
  assert.equal(fs.files.get("/v/.trash/plan-n1.md"), before);
});

test("the trash is listed in one call, without texts, with the file of each note to read them from", async () => {
  const listed = [
    {
      id: "n1",
      title: "Plan",
      folderId: "Work",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      kind: "code",
      path: ".trash/plan-n1.md",
      mtimeMs: 5,
      size: 9,
    },
  ];
  core.invoke.mockResolvedValue(listed);
  const trash = await storage.loadTrash(V);
  assert.deepEqual(core.invoke.mock.calls, [["scan_trash", { path: V }]]);
  const [plan] = trash.items;
  // Where it was before it was trashed, the scan's kind, and no text yet: a restore reads it first, and nothing writes it before
  assert.equal(plan.folderId, "Work");
  assert.deepEqual(plan.unloaded, { kind: "code" });
  assert.equal(plan.body, "");
  assert.deepEqual(trash.files.get("n1"), {
    path: ".trash/plan-n1.md",
    mtimeMs: 5,
    size: 9,
  });
  // A trash that cannot be listed is an error (invoke rejects with a string), not an empty trash
  core.invoke.mockRejectedValue("outside the vault folders Graphene may read");
  await assert.rejects(storage.loadTrash(V), /outside the vault folders/);
  // A restore of a note that was not read is refused by the write, so the hook reads the text first
  await assert.rejects(storage.restoreItemFile(V, plan), /has not been read/);
});

/** What a scan does to the memory of made folders: it forgets it. The log starts empty after it. */
async function freshScan() {
  core.invoke.mockResolvedValue({ notes: [], folders: [], trashCount: 0 });
  await storage.loadVault(V);
  fs.log.length = 0;
}
const mkdirs = () => fs.log.filter((l) => l.startsWith("mkdir"));

test("saves into a folder that is known to exist do not ask for it again", async () => {
  await freshScan();
  await storage.saveItem(V, item());
  await storage.saveItem(V, item({ body: "more" }));
  await storage.saveItem(V, item({ id: "n2", folderId: "a" }));
  await storage.saveItem(V, item({ id: "n2", folderId: "a", body: "more" }));
  await storage.replaceItemFile(
    V,
    item({ id: "n2", folderId: "a" }),
    item({ id: "n2", folderId: "a", body: "x" }),
  );
  // the vault's own folder is never made by a save: a scan saw it, and below it only "a" is made
  assert.deepEqual(mkdirs(), ["mkdir /v/a"]);
  // the note itself is written every time
  assert.equal(fs.log.filter((l) => l.startsWith("rename ")).length, 5);
});

test("another vault is not covered by what was made in this one", async () => {
  await freshScan();
  fs.dirs.add("/w");
  await storage.saveItem(V, item({ folderId: "a" }));
  await storage.saveItem("/w", item({ folderId: "a" }));
  assert.deepEqual(mkdirs(), ["mkdir /v/a", "mkdir /w/a"]);
});

test("renaming or deleting a folder makes the next save ask again, for it and for what is inside", async () => {
  await freshScan();
  await storage.saveItem(V, item({ id: "n1", folderId: "a" }));
  await storage.saveItem(V, item({ id: "n2", folderId: "a/b" }));
  await storage.saveItem(V, item({ id: "n3", folderId: "other" }));
  fs.log.length = 0;

  await storage.renameFolderDir(V, "a", "c");
  await storage.saveItem(V, item({ id: "n3", folderId: "other" })); // not touched by the rename
  await storage.saveItem(V, item({ id: "n1", folderId: "c" }));
  await storage.saveItem(V, item({ id: "n1", folderId: "c", body: "2" }));
  assert.deepEqual(mkdirs(), ["mkdir /v/c"]);
  // a save that still says the old name finds nothing remembered for it or for what was inside it
  await storage.saveItem(V, item({ id: "n4", folderId: "a" }));
  await storage.saveItem(V, item({ id: "n5", folderId: "a/b" }));
  assert.deepEqual(mkdirs(), ["mkdir /v/c", "mkdir /v/a", "mkdir /v/a/b"]);

  fs.log.length = 0;
  await storage.deleteFolderDir(V, "c");
  await storage.saveItem(V, item({ id: "n1", folderId: "c" }));
  await storage.saveItem(V, item({ id: "n1", folderId: "c", body: "2" }));
  assert.deepEqual(mkdirs(), ["mkdir /v/.trash", "mkdir /v/c"]);
});

test("a folder that sorts like a renamed one but is another is left alone", async () => {
  await freshScan();
  await storage.saveItem(V, item({ id: "n1", folderId: "ab" }));
  fs.log.length = 0;
  fs.dirs.add("/v/a");
  await storage.renameFolderDir(V, "a", "z"); // "/v/ab" does not start with "/v/a/"
  await storage.saveItem(V, item({ id: "n1", folderId: "ab", body: "2" }));
  assert.deepEqual(mkdirs(), []);
});

test("a failed write forgets its folder, and a failed mkdir is not remembered", async () => {
  await freshScan();
  fs.state.fail = (op) => op === "mkdir";
  await assert.rejects(
    storage.saveItem(V, item({ folderId: "a" })),
    /mkdir failed/,
  );
  fs.state.fail = () => false;
  await storage.saveItem(V, item({ folderId: "a" })); // asks again, and is remembered now
  await storage.saveItem(V, item({ folderId: "a", body: "2" }));
  assert.deepEqual(mkdirs(), ["mkdir /v/a", "mkdir /v/a"]);

  fs.log.length = 0;
  fs.state.fail = (op, path) => op === "write" && path.endsWith(".tmp");
  await assert.rejects(
    storage.saveItem(V, item({ folderId: "a", body: "3" })),
    /write failed/,
  );
  fs.state.fail = () => false;
  await storage.saveItem(V, item({ folderId: "a", body: "4" }));
  assert.deepEqual(mkdirs(), ["mkdir /v/a"]); // once, after the failure
});

test("a scan, at the start or on a window focus, makes the next save look at its folder again", async () => {
  await freshScan();
  await storage.saveItem(V, item({ folderId: "a" }));
  fs.log.length = 0;
  await storage.rescanVault(V, new Map(), new Set());
  await storage.saveItem(V, item({ folderId: "a", body: "2" }));
  assert.deepEqual(mkdirs(), ["mkdir /v/a"]);
  await storage.saveItem(V, item({ folderId: "a", body: "3" }));
  assert.deepEqual(mkdirs(), ["mkdir /v/a"]);
  await storage.loadVault(V);
  await storage.saveItem(V, item({ folderId: "a", body: "4" }));
  assert.deepEqual(mkdirs(), ["mkdir /v/a", "mkdir /v/a"]);
});

/** The vault's folder is gone (renamed, deleted, a drive unplugged), and the app does not know yet or has been told. */
function vaultGone() {
  fs.dirs.delete(V);
  fs.files.clear();
  fs.log.length = 0;
}

test("a write never makes a vault folder that is gone: it rejects with a plain reason and creates nothing", async () => {
  rootLost(V); // a scan that failed, or no scan yet
  vaultGone();
  const reason = /vault folder is not there/;
  await assert.rejects(storage.saveItem(V, item()), reason);
  await assert.rejects(storage.saveItem(V, item({ folderId: "a" })), reason);
  await assert.rejects(
    storage.replaceItemFile(V, item(), item({ title: "Roadmap" })),
    reason,
  );
  await assert.rejects(storage.createFolderDir(V, folder("a")), reason);
  await assert.rejects(storage.moveItemFile(V, item(), null), reason);
  await assert.rejects(storage.moveItemFile(V, item(), "a"), reason);
  await assert.rejects(storage.restoreItemFile(V, item()), reason);
  assert.equal(fs.dirs.has(V), false); // not recreated
  assert.equal(fs.dirs.size, 0);
  assert.equal(fs.files.size, 0);
  assert.deepEqual(mkdirs(), []);
  // the error is the one the toast puts after "Could not save"
  await assert.rejects(
    storage.saveItem(V, item()),
    (e) => e instanceof Error && e.name === "VaultMissingError",
  );
});

test("a vault whose folder came back is written to again, and the check is not repeated for every save", async () => {
  rootLost(V);
  vaultGone();
  await assert.rejects(storage.saveItem(V, item()), /not there/);
  fs.dirs.add(V);
  await storage.saveItem(V, item());
  assert.ok(fs.files.has("/v/plan-n1.md"));
});

test("a scan that listed the vault makes writes below it work with no look at the folder, and a failed scan or write makes the next look again", async () => {
  await freshScan(); // the vault is known to be there
  vaultGone();
  // nothing has noticed: a note at the top level cannot be written (no mkdir, so the temp file has no folder); the failed write
  // looks at the vault folder at once and names it as the reason, and nothing is made
  await assert.rejects(storage.saveItem(V, item()), /not there/);
  assert.equal(fs.dirs.has(V), false);
  // and the next write knows too
  await assert.rejects(storage.saveItem(V, item()), /not there/);

  fs.dirs.add(V);
  await freshScan();
  vaultGone();
  core.invoke.mockRejectedValue("gone"); // the focus rescan finds no folder
  await assert.rejects(storage.rescanVault(V, new Map(), new Set()), Error);
  await assert.rejects(
    storage.saveItem(V, item({ folderId: "a" })),
    /not there/,
  );
  assert.equal(fs.dirs.size, 0); // "a" was not made either, and with it the vault folder
});

function folder(name: string) {
  return {
    id: name,
    name,
    parentId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

test("sweepUnusedImages with a list looks only at those pictures and keeps one another note still links", async () => {
  fs.dirs.add("/v/attachments");
  fs.dirs.add("/v/.trash");
  for (const f of ["aaaaaaaaaa", "bbbbbbbbbb", "cccccccccc", "dddddddddd"])
    fs.files.set(`/v/attachments/${f}.png`, "x");
  put(
    "/v/live-n2.md",
    item({ id: "n2", title: "Live", body: "![](attachments/aaaaaaaaaa.png)" }),
  );
  put(
    "/v/.trash/old-n3.md",
    item({
      id: "n3",
      title: "Old",
      body: "![](../attachments/bbbbbbbbbb.png)",
    }),
  );
  await storage.sweepUnusedImages(V, [
    "aaaaaaaaaa.png",
    "bbbbbbbbbb.png",
    "cccccccccc.png",
  ]);
  // a live note and a trashed one keep theirs; cccc was listed and is unused; dddd is unused too but was not listed
  assert.deepEqual(
    names().filter((n) => n.includes("/attachments/")),
    [
      "/v/attachments/aaaaaaaaaa.png",
      "/v/attachments/bbbbbbbbbb.png",
      "/v/attachments/dddddddddd.png",
    ],
  );
  // With no list it is the sweep of Empty trash: every unused one goes
  await storage.sweepUnusedImages(V);
  assert.deepEqual(
    names().filter((n) => n.includes("/attachments/")),
    ["/v/attachments/aaaaaaaaaa.png", "/v/attachments/bbbbbbbbbb.png"],
  );
});
