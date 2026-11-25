// src/lib/treeNav.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import type { Folder } from "../types";
import {
  folderLevel,
  type TreeKey,
  type TreeMove,
  type TreeRow,
  treeItemId,
  treeStep,
  visibleRows,
} from "./treeNav";

const folder = (id: string): Folder => ({
  id,
  name: id.slice(id.lastIndexOf("/") + 1),
  parentId: id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : null,
  createdAt: "2026-01-01T00:00:00.000Z",
});
const byName = (a: Folder, b: Folder) => a.name.localeCompare(b.name);
const notes = (...ids: string[]) => ids.map((id) => ({ id }));

// b (closed, has a note) a (open: a/x with a note n3, then notes n1 n2) and the unfiled u1
const folders = [folder("b"), folder("a"), folder("a/x")];
const byFolder = new Map([
  ["a", notes("n1", "n2")],
  ["a/x", notes("n3")],
  ["b", notes("n4")],
  [null, notes("u1")],
]);
const rowsWith = (collapsed: string[]) =>
  visibleRows(folders, byFolder, byName, (id) => collapsed.includes(id));
const keys = (rows: TreeRow[]) => rows.map((r) => `${r.kind[0]}:${r.id}`);

test("the visible rows follow the drawing order: a folder, its subfolders, its notes, then the unfiled notes", () => {
  assert.deepEqual(keys(rowsWith([])), [
    "f:a",
    "f:a/x",
    "i:n3",
    "i:n1",
    "i:n2",
    "f:b",
    "i:n4",
    "i:u1",
  ]);
});

test("a closed folder hides everything inside it, however deep", () => {
  assert.deepEqual(keys(rowsWith(["a"])), ["f:a", "f:b", "i:n4", "i:u1"]);
  assert.deepEqual(keys(rowsWith(["a/x"])), [
    "f:a",
    "f:a/x",
    "i:n1",
    "i:n2",
    "f:b",
    "i:n4",
    "i:u1",
  ]);
});

test("only a folder with something inside can be open", () => {
  const rows = visibleRows([folder("e")], new Map(), byName, () => false);
  assert.deepEqual(rows[0], {
    kind: "folder",
    id: "e",
    parent: null,
    expandable: false,
    expanded: false,
  });
});

const step = (rows: TreeRow[], from: TreeKey | null, move: TreeMove) =>
  treeStep(rows, from, move);
const f = (id: string): TreeKey => ({ kind: "folder", id });
const n = (id: string): TreeKey => ({ kind: "item", id });

test("Down and Up pass through the folders as rows", () => {
  const rows = rowsWith([]);
  assert.deepEqual(step(rows, f("a"), "down"), { do: "focus", row: rows[1] });
  assert.deepEqual(step(rows, n("n2"), "down"), { do: "focus", row: rows[5] });
  assert.deepEqual(step(rows, n("n3"), "up"), { do: "focus", row: rows[1] });
  assert.deepEqual(step(rows, f("b"), "up"), { do: "focus", row: rows[4] });
});

test("Down and Up stop at the ends; with no row they start at the first", () => {
  const rows = rowsWith([]);
  assert.equal(step(rows, n("u1"), "down"), null);
  assert.equal(step(rows, f("a"), "up"), null);
  assert.deepEqual(step(rows, null, "down"), { do: "focus", row: rows[0] });
  assert.deepEqual(step(rows, null, "up"), { do: "focus", row: rows[0] });
  // a note that is on no visible row (its folder was closed) is no row either
  const closed = rowsWith(["a"]);
  assert.deepEqual(step(closed, n("n1"), "down"), {
    do: "focus",
    row: closed[0],
  });
});

test("Home and End go to the first and last row", () => {
  const rows = rowsWith([]);
  assert.deepEqual(step(rows, n("n2"), "home"), { do: "focus", row: rows[0] });
  assert.deepEqual(step(rows, n("n2"), "end"), { do: "focus", row: rows[7] });
  assert.equal(step(rows, f("a"), "home"), null);
  assert.equal(step(rows, n("u1"), "end"), null);
});

test("Right opens a closed folder, goes into an open one, and does nothing on a note or an empty folder", () => {
  const rows = rowsWith(["b"]);
  assert.deepEqual(step(rows, f("b"), "right"), { do: "expand", id: "b" });
  assert.deepEqual(step(rows, f("a"), "right"), { do: "focus", row: rows[1] });
  assert.equal(step(rows, n("n1"), "right"), null);
  const empty = visibleRows([folder("e")], new Map(), byName, () => false);
  assert.equal(step(empty, f("e"), "right"), null);
});

test("Left closes an open folder, else goes to the folder it sits in", () => {
  const rows = rowsWith(["b"]);
  assert.deepEqual(step(rows, f("a"), "left"), { do: "collapse", id: "a" });
  assert.deepEqual(step(rows, f("a/x"), "left"), { do: "collapse", id: "a/x" });
  assert.deepEqual(step(rows, n("n3"), "left"), { do: "focus", row: rows[1] });
  assert.deepEqual(step(rows, n("n1"), "left"), { do: "focus", row: rows[0] });
  // a closed folder goes up to its parent; at the top level, and for a note outside any folder, nothing
  const closed = rowsWith(["a/x"]);
  assert.deepEqual(step(closed, f("a/x"), "left"), {
    do: "focus",
    row: closed[0],
  });
  assert.equal(step(rows, f("b"), "left"), null);
  assert.equal(step(rows, n("u1"), "left"), null);
});

test("no rows, nothing to do", () => {
  assert.equal(step([], null, "down"), null);
  assert.equal(step([], f("a"), "right"), null);
});

test("a row's DOM id has no spaces or slashes, and a note's differs from a folder's of the same name", () => {
  assert.equal(treeItemId(f("My Docs/a b")), "tree-f-My%20Docs%2Fa%20b");
  assert.notEqual(treeItemId(f("x")), treeItemId(n("x")));
});

test("a folder's level is its depth in its path", () => {
  assert.equal(folderLevel("a"), 1);
  assert.equal(folderLevel("a/b/c"), 3);
});
