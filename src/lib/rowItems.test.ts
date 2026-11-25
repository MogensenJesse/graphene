// src/lib/rowItems.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import type { Folder, Item } from "../types";
import { compareItemsManual } from "./order";
import {
  groupByFolder,
  notesUnder,
  rowItems,
  sameRow,
  sortRows,
} from "./rowItems";

const note = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  title: id,
  folderId: null,
  body: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  ...extra,
});
const unloaded = (id: string, extra: Partial<Item> = {}) =>
  note(id, { unloaded: { kind: "note" }, ...extra });

test("a note's text is not part of what a row shows, but its title, folder, rank, date and kind are", () => {
  assert.equal(sameRow(unloaded("a"), note("a", { body: "text" })), true);
  assert.equal(sameRow(note("a"), note("a", { title: "b" })), false);
  assert.equal(sameRow(note("a"), note("a", { folderId: "f" })), false);
  assert.equal(sameRow(note("a"), note("a", { order: 1 })), false);
  assert.equal(
    sameRow(note("a"), note("a", { updatedAt: "2026-02-01T00:00:00.000Z" })),
    false,
  );
  // typing a fence at the start turns a note into code: its icon changes
  assert.equal(sameRow(note("a"), note("a", { body: "```js\n```" })), false);
});

test("a batch of texts leaves the sidebar's notes as they were: the same array, the same objects", () => {
  const before = [unloaded("a"), unloaded("b"), unloaded("c")];
  const first = rowItems([], before);
  assert.deepEqual(first, before);
  const batch = [
    note("a", { body: "one" }),
    note("b", { body: "two" }),
    before[2],
  ];
  assert.equal(rowItems(first, batch), first);
});

test("a change to one note replaces that one only, and a new array comes back", () => {
  const first = rowItems([], [note("a"), note("b"), note("c")]);
  const next = [first[0], note("b", { title: "renamed" }), first[2]];
  const rows = rowItems(first, next);
  assert.notEqual(rows, first);
  assert.equal(rows[0], first[0]);
  assert.equal(rows[1], next[1]);
  assert.equal(rows[2], first[2]);
});

test("notes added, removed or reordered are found by id", () => {
  const first = rowItems([], [note("a"), note("b"), note("c")]);
  const removed = rowItems(first, [first[2], first[0]]);
  assert.deepEqual(
    removed.map((n) => n.id),
    ["c", "a"],
  );
  assert.equal(removed[0], first[2]);
  assert.equal(removed[1], first[0]);
  // a text read for a note that moved in the list is still the same row
  const reordered = rowItems(first, [
    note("c", { body: "x" }),
    first[0],
    first[1],
  ]);
  assert.equal(reordered[0], first[2]);
  const added = rowItems(first, [...first, note("d")]);
  assert.equal(added.length, 4);
  assert.equal(added[3].id, "d");
});

test("a folder whose notes are the same keeps its array, so only the folder that changed renders again", () => {
  const a = note("a", { folderId: "F" });
  const b = note("b", { folderId: "G" });
  const c = note("c");
  const first = groupByFolder([a, b, c], new Map());
  assert.deepEqual([...first.keys()], ["F", "G", null]);

  const b2 = note("b", { folderId: "G", title: "renamed" });
  const next = groupByFolder([a, b2, c], first);
  assert.equal(next.get("F"), first.get("F"));
  assert.equal(next.get(null), first.get(null));
  assert.notEqual(next.get("G"), first.get("G"));
  assert.equal(groupByFolder([a, b, c], first).get("G"), first.get("G"));
});

test("notes under a folder count those in its subfolders, and not in a folder that only starts with its name", () => {
  const folder: Folder = {
    id: "Work",
    name: "Work",
    parentId: null,
    createdAt: "",
  };
  const byFolder = groupByFolder(
    [
      note("1", { folderId: "Work" }),
      note("2", { folderId: "Work/Sub" }),
      note("3", { folderId: "Work/Sub/Deep" }),
      note("4", { folderId: "Workshop" }),
      note("5"),
    ],
    new Map(),
  );
  assert.equal(notesUnder(folder, byFolder), 3);
});

const byName = (a: Item, b: Item) => a.title.localeCompare(b.title);
const byEdited = (a: Item, b: Item) => b.updatedAt.localeCompare(a.updatedAt);
const sameOrderAsFresh = (sorted: Item[], rows: Item[], by: typeof byName) => {
  const fresh = rows.slice().sort(by);
  assert.equal(sorted.length, fresh.length);
  for (const [at, n] of fresh.entries()) assert.equal(sorted[at], n);
};

test("a save that cannot move a note leaves the sort alone: only the note that changed is compared, and none changed means the same array", () => {
  let compared = 0;
  const counted = (a: Item, b: Item) => {
    compared++;
    return byName(a, b);
  };
  const rows = ["d", "b", "c", "a"].map((id) => note(id));
  const first = sortRows(null, rows, counted);
  assert.deepEqual(
    first.sorted.map((n) => n.id),
    ["a", "b", "c", "d"],
  );

  // the edited date of b changes: by name it stays where it is
  const b2 = note("b", { updatedAt: "2026-03-01T00:00:00.000Z" });
  const next = [rows[0], b2, rows[2], rows[3]];
  compared = 0;
  const again = sortRows(first, next, counted);
  assert.equal(compared, 1);
  assert.equal(again.sorted[1], b2);
  assert.equal(again.sorted[0], rows[3]);
  sameOrderAsFresh(again.sorted, next, byName);

  // nothing changed (a batch of texts): the very array, with nothing compared
  compared = 0;
  assert.equal(sortRows(again, next, counted).sorted, again.sorted);
  assert.equal(sortRows(first, rows, counted).sorted, first.sorted);
  assert.equal(compared, 0);
});

test("a change that can move a note, a new sort, or notes added or removed are sorted again", () => {
  const rows = [
    note("a", { updatedAt: "2026-01-03T00:00:00.000Z" }),
    note("b", { updatedAt: "2026-01-02T00:00:00.000Z" }),
    note("c", { updatedAt: "2026-01-01T00:00:00.000Z" }),
  ];
  const first = sortRows(null, rows, byEdited);
  assert.deepEqual(
    first.sorted.map((n) => n.id),
    ["a", "b", "c"],
  );
  // c is saved: by edited date it jumps to the top
  const c2 = note("c", { updatedAt: "2026-04-01T00:00:00.000Z" });
  const next = [rows[0], rows[1], c2];
  const moved = sortRows(first, next, byEdited);
  assert.deepEqual(
    moved.sorted.map((n) => n.id),
    ["c", "a", "b"],
  );
  sameOrderAsFresh(moved.sorted, next, byEdited);

  // the same notes, ordered another way
  const named = sortRows(first, rows, byName);
  assert.deepEqual(
    named.sorted.map((n) => n.id),
    ["a", "b", "c"],
  );
  assert.notEqual(named.sorted, first.sorted);

  const more = [...next, note("d")];
  assert.equal(sortRows(moved, more, byEdited).sorted.length, 4);
  assert.equal(sortRows(moved, next.slice(1), byEdited).sorted.length, 2);
  // a note put in another place in the list, or another note in its place
  const swapped = [next[1], next[0], next[2]];
  sameOrderAsFresh(
    sortRows(moved, swapped, byEdited).sorted,
    swapped,
    byEdited,
  );
  const replaced = [rows[0], note("x"), c2];
  sameOrderAsFresh(
    sortRows(moved, replaced, byEdited).sorted,
    replaced,
    byEdited,
  );
});

test("notes that compare equal stay in the order the list gave them, as a fresh sort would put them", () => {
  const rows = [
    note("1", { title: "same" }),
    note("2", { title: "same" }),
    note("3", { title: "same" }),
  ];
  const first = sortRows(null, rows, byName);
  const next = [rows[0], note("2", { title: "same", updatedAt: "x" }), rows[2]];
  sameOrderAsFresh(sortRows(first, next, byName).sorted, next, byName);
  // a rank change moves a note under the manual order, so it is sorted again
  const ranked = [note("a"), note("b"), note("c")];
  const manual = sortRows(null, ranked, compareItemsManual);
  const reranked = [ranked[0], ranked[1], note("c", { order: 1 })];
  const out = sortRows(manual, reranked, compareItemsManual).sorted;
  assert.equal(out[0].id, "c");
  sameOrderAsFresh(out, reranked, compareItemsManual);
});
