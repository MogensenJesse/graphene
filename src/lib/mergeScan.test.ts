// src/lib/mergeScan.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { parseNoteFile, serializeItem } from "./fileFormat";
import { mergeFolders, mergeItems } from "./mergeScan";

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
  // nothing changed: the same array comes back, objects kept
  const same = mergeItems([a, b], [item("b", "B"), item("a")], null);
  assert.deepEqual(same, [a, b]);
  assert.equal(mergeItems([a, b], [{ ...b }, { ...a }], null)[0], a);
  const prev = [a, b];
  assert.equal(mergeItems(prev, [{ ...a }, { ...b }], null), prev);
  // new on disk
  let out = mergeItems([a], [a, c], null);
  assert.deepEqual(
    out.map((i) => i.id),
    ["a", "c"],
  );
  // gone from disk
  out = mergeItems([a, b], [a], null);
  assert.deepEqual(
    out.map((i) => i.id),
    ["a"],
  );
  // edited on disk
  out = mergeItems([a, b], [a, { ...b, body: "changed" }], null);
  assert.equal(out[1].body, "changed");
  assert.equal(out[0], a);
  // moved on disk
  out = mergeItems([a], [{ ...a, folderId: "X" }], null);
  assert.equal(out[0].folderId, "X");
  // put in another place of the order on disk
  out = mergeItems([a], [{ ...a, order: 5 }], null);
  assert.equal(out[0].order, 5);
  // the note open in a dirty editor is left alone, even when gone or changed on disk
  out = mergeItems([a, b], [{ ...a, body: "disk" }], "a");
  assert.deepEqual(
    out.map((i) => [i.id, i.body]),
    [["a", "b"]].map(([id, body]) => [id, body]),
  );
  assert.equal(out.length, 1); // b is gone on disk
  assert.equal(mergeItems([a], [], "a")[0], a);

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
