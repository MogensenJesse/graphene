// src/lib/mergeScan.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import type { Item } from "../types";
import { parseNoteFile, serializeItem } from "./fileFormat";
import {
  applyBodies,
  changedNotes,
  itemsFromRescan,
  mergeFolders,
  mergeItems,
  mergeTrash,
  stampsAfter,
} from "./mergeScan";
import { itemFromScan, type ScannedNote, stampOf } from "./vaultScan";

test("merging a scan into memory", () => {
  const item = (
    id: string,
    title = "t",
    body = "b",
    folderId: string | null = null,
  ) => ({
    id,
    title,
    body,
    folderId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  // ── parseNoteFile: CRLF ──
  const note = item("abc", "Hello", "line 1\nline 2\n", "Work");
  const lf = serializeItem(note);
  assert.deepEqual(parseNoteFile(lf), note);
  const crlf = lf.replace(/\n/g, "\r\n");
  assert.deepEqual(parseNoteFile(crlf), note); // used to come back with no id
  assert.deepEqual(parseNoteFile(`\uFEFF${crlf}`), note); // BOM too
  assert.equal(
    parseNoteFile("no frontmatter\r\nhere").body,
    "no frontmatter\nhere",
  );
  assert.equal(parseNoteFile("no frontmatter").id, "");
  // leading newline in the body survives a round trip
  const lead = item("x", "t", "\nstarts blank");
  assert.deepEqual(parseNoteFile(serializeItem(lead)), lead);

  // ── mergeItems ──
  const a = item("a");
  const b = item("b", "B");
  const c = item("c");
  const NONE: ReadonlySet<string> = new Set();
  const KEEP_A: ReadonlySet<string> = new Set(["a"]);
  // nothing changed: the same array comes back, objects kept
  const same = mergeItems([a, b], [item("b", "B"), item("a")], NONE);
  assert.deepEqual(same, [a, b]);
  assert.equal(mergeItems([a, b], [{ ...b }, { ...a }], NONE)[0], a);
  const prev = [a, b];
  assert.equal(mergeItems(prev, [{ ...a }, { ...b }], NONE), prev);
  // new on disk
  let out = mergeItems([a], [a, c], NONE);
  assert.deepEqual(
    out.map((i) => i.id),
    ["a", "c"],
  );
  // gone from disk
  out = mergeItems([a, b], [a], NONE);
  assert.deepEqual(
    out.map((i) => i.id),
    ["a"],
  );
  // edited on disk
  out = mergeItems([a, b], [a, { ...b, body: "changed" }], NONE);
  assert.equal(out[1].body, "changed");
  assert.equal(out[0], a);
  // moved on disk
  out = mergeItems([a], [{ ...a, folderId: "X" }], NONE);
  assert.equal(out[0].folderId, "X");
  // put in another place of the order on disk
  out = mergeItems([a], [{ ...a, order: 5 }], NONE);
  assert.equal(out[0].order, 5);
  // a kept note (open in a dirty editor, or its write failed) is left alone, even when gone or changed on disk
  out = mergeItems([a, b], [{ ...a, body: "disk" }], KEEP_A);
  assert.deepEqual(
    out.map((i) => [i.id, i.body]),
    [["a", "b"]].map(([id, body]) => [id, body]),
  );
  assert.equal(out.length, 1); // b is gone on disk
  assert.equal(mergeItems([a], [], KEEP_A)[0], a);
  // a kept note that is not on disk yet (its first write failed) stays, and the rest of the scan still applies
  const failed = item("f", "unsaved", "typed");
  out = mergeItems([failed, a], [{ ...a, body: "disk" }, c], new Set(["f"]));
  assert.deepEqual(
    out.map((i) => i.id),
    ["f", "a", "c"],
  );
  assert.equal(out[0], failed);
  assert.equal(out[1].body, "disk");
  // two kept notes, and a scan that matches memory returns the same array
  const kept = [a, b];
  assert.equal(
    mergeItems(kept, [{ ...a }, { ...b }], new Set(["a", "b"])),
    kept,
  );
  assert.equal(mergeItems(kept, [], new Set(["a", "b"])), kept);

  // ── mergeFolders ──
  const f = (
    id: string,
    parentId: string | null = null,
    createdAt = "old",
  ) => ({
    id,
    name: id,
    parentId,
    createdAt,
  });
  const folders = [f("A"), f("A/B", "A")];
  assert.equal(
    mergeFolders(folders, [f("A", null, "new"), f("A/B", "A", "new")]),
    folders,
  );
  const grown = mergeFolders(folders, [
    f("A", null, "new"),
    f("A/B", "A", "new"),
    f("C", null, "new"),
  ]);
  assert.equal(grown.length, 3);
  assert.equal(grown[0], folders[0]); // known folders keep their object
  assert.equal(grown[2].createdAt, "new");
  assert.equal(mergeFolders(folders, [f("A", null, "new")]).length, 1);
  // a new rank on disk replaces the folder; the same rank keeps it
  const ranked = [{ ...f("A"), order: 2 }];
  assert.equal(mergeFolders(ranked, [{ ...f("A"), order: 2 }]), ranked);
  assert.equal(mergeFolders(ranked, [{ ...f("A"), order: 9 }])[0].order, 9);
  assert.equal(mergeFolders(ranked, [f("A")])[0].order, undefined);
  assert.equal(mergeFolders([], []).length, 0);
});

// ── What the startup scan lists without text (Item.unloaded) ──

const note = (over: Partial<ScannedNote> = {}): ScannedNote => ({
  id: "a",
  title: "A",
  folderId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  kind: "note",
  path: "a-a.md",
  mtimeMs: 10,
  size: 5,
  ...over,
});
const waiting = (n: ScannedNote) => itemFromScan(n);
const none: ReadonlySet<string> = new Set();

test("a text that was read goes only into a note that is still waiting for it", () => {
  const a = waiting(note({ id: "a" }));
  const b = waiting(note({ id: "b" }));
  const out = applyBodies([a, b], new Map([["a", "text of a"]]), none);
  assert.equal(out[0].body, "text of a");
  assert.equal(out[0].unloaded, undefined);
  assert.equal("unloaded" in out[0], false);
  assert.equal(out[1], b); // no text for it: the same object, still waiting
  assert.ok(out[1].unloaded);
  // no text for anything: the same array
  const prev = [a, b];
  assert.equal(applyBodies(prev, new Map(), none), prev);
});

test("a late text never replaces a note that was loaded, typed in or saved since the scan", () => {
  const typed = { ...waiting(note({ id: "t" })), body: "typed" };
  delete typed.unloaded; // loaded by a priority read, then edited
  const out = applyBodies([typed], new Map([["t", "older, from disk"]]), none);
  assert.equal(out[0], typed);
  assert.equal(out[0].body, "typed");
  // a note whose write failed is the user's text, even if it were still marked waiting
  const failed = waiting(note({ id: "f" }));
  const kept = applyBodies([failed], new Map([["f", "disk"]]), new Set(["f"]));
  assert.equal(kept[0], failed);
  // and a note that is not in the list any more (trashed) is ignored
  assert.deepEqual(applyBodies([], new Map([["gone", "x"]]), none), []);
});

test("a rescan reads only the notes that are new or whose file changed", () => {
  const same = note({ id: "same" });
  const moved = note({ id: "moved", path: "work/moved.md" });
  const touched = note({ id: "touched", mtimeMs: 99 });
  const grown = note({ id: "grown", size: 6 });
  const fresh = note({ id: "fresh" });
  const gone = note({ id: "gone" }); // on disk, not on screen (no longer in memory)
  const known = new Map(
    [same, moved, touched, grown, gone].map((n) => [n.id, stampOf(n)]),
  );
  known.set("moved", { ...stampOf(moved), path: "moved.md" });
  known.set("touched", { ...stampOf(touched), mtimeMs: 10 });
  known.set("grown", { ...stampOf(grown), size: 5 });
  const inMemory = new Set(["same", "moved", "touched", "grown"]);
  const read = changedNotes(
    [same, moved, touched, grown, fresh, gone],
    known,
    inMemory,
  ).map((n) => n.id);
  assert.deepEqual(read, ["moved", "touched", "grown", "fresh", "gone"]);
  // nothing changed: nothing is read
  assert.deepEqual(
    changedNotes([same], new Map([["same", stampOf(same)]]), new Set(["same"])),
    [],
  );
});

test("a rescan keeps the notes it did not read, builds the ones it did, and drops a new one it could not read", () => {
  const kept = waiting(note({ id: "kept" }));
  const stale = {
    ...waiting(note({ id: "stale", title: "old" })),
    body: "old",
  };
  const failed = waiting(note({ id: "failed" }));
  const scanned = [
    note({ id: "kept" }),
    note({ id: "stale", title: "new" }),
    note({ id: "failed", mtimeMs: 77 }),
    note({ id: "added", title: "Added" }),
    note({ id: "added-unread" }),
  ];
  const out = itemsFromRescan(
    [kept, stale, failed],
    scanned,
    new Map([
      ["stale", "new text"],
      ["added", "added text"],
    ]),
  );
  assert.deepEqual(
    out.map((i) => i.id),
    ["kept", "stale", "failed", "added"],
  );
  assert.equal(out[0], kept); // its object, so nothing re-renders
  assert.equal(out[1].body, "new text");
  assert.equal(out[1].title, "new");
  assert.equal(out[1].unloaded, undefined);
  assert.equal(out[2], failed); // changed on disk but unreadable: left as it is
  assert.equal(out[3].body, "added text");
  // merged into memory, a note nobody read stays waiting and the rest follows the disk
  const merged = mergeItems([kept, stale, failed], out, none);
  assert.equal(merged[0], kept);
  assert.equal(merged[1].body, "new text");
});

test("a rescan remembers the files it saw, except for notes it did not apply or could not read", () => {
  const a = note({ id: "a", mtimeMs: 2 });
  const b = note({ id: "b", mtimeMs: 2 });
  const c = note({ id: "c", mtimeMs: 2 });
  const d = note({ id: "d", mtimeMs: 2 });
  const known = new Map([
    ["a", { ...stampOf(a), mtimeMs: 1 }],
    ["b", { ...stampOf(b), mtimeMs: 1 }],
    ["c", { ...stampOf(c), mtimeMs: 1 }],
  ]);
  const next = stampsAfter(
    known,
    [a, b, c, d],
    new Set(["a", "b", "d"]), // asked for
    new Map([["a", "read"]]), // only a came back
    new Set(["c"]), // c is the user's, not applied
  );
  assert.equal(next.get("a")?.mtimeMs, 2); // read: remembered as it is now
  assert.equal(next.get("b")?.mtimeMs, 1); // not read: still the old file, so it is read again next time
  assert.equal(next.get("c")?.mtimeMs, 1); // kept: same
  assert.equal(next.has("d"), false); // new and not read: unknown, read again
  assert.equal(stampsAfter(known, [], new Set(), new Map(), none).size, 0); // a note gone from disk is forgotten
});

test("the trash is what is on disk plus what was trashed since, minus notes that are live again", () => {
  const item = (id: string, body = "b"): Item => ({
    id,
    title: id,
    folderId: null,
    body,
    createdAt: "",
    updatedAt: "",
  });
  const since = [item("new", "loaded text")];
  const out = mergeTrash(
    since,
    [item("new", "from disk"), item("old"), item("restored")],
    new Set(["restored"]),
  );
  assert.deepEqual(
    out.map((i) => i.id),
    ["new", "old"],
  );
  assert.equal(out[0], since[0]); // the one in memory wins
  assert.deepEqual(mergeTrash([], [], none), []);
});
