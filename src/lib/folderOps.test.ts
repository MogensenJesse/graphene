// src/lib/folderOps.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import type { Folder } from "../types";
import { relinkAttachments } from "./attachments";
import {
  folderChain,
  movedFolders,
  moveProblem,
  planRestore,
  reId,
  snapshotFolder,
} from "./folderOps";

const f = (id: string, order?: number): Folder => {
  const cut = id.lastIndexOf("/");
  return {
    id,
    name: id.slice(cut + 1),
    parentId: cut < 0 ? null : id.slice(0, cut),
    createdAt: "2026-01-01T00:00:00.000Z",
    ...(order === undefined ? {} : { order }),
  };
};
const note = (id: string, folderId: string | null, order?: number) => ({
  id,
  folderId,
  order,
});

// Work (rank 1) > Plans (rank 2) > Old; Work > Misc; Home; "Work 2" is not under Work
const tree = [
  f("Work", 1),
  f("Work/Plans", 2),
  f("Work/Plans/Old", 3),
  f("Work/Misc"),
  f("Home"),
  f("Work 2"),
];
const notes = [
  note("a", "Work", 10),
  note("b", "Work/Plans"),
  note("c", "Work/Plans/Old", 30),
  note("d", "Home"),
  note("e", "Work 2"),
  note("f", null),
];

test("a snapshot holds the folder and what is under it (not a folder that only starts like it), and the notes with their folder and rank", () => {
  const snap = snapshotFolder(tree, notes, "Work");
  assert.ok(snap);
  assert.deepEqual(
    snap.folders.map((x) => x.id),
    ["Work", "Work/Plans", "Work/Plans/Old", "Work/Misc"],
  );
  assert.equal(snap.folders[1].order, 2);
  assert.deepEqual(snap.notes, [
    { id: "a", folderId: "Work", order: 10 },
    { id: "b", folderId: "Work/Plans", order: undefined },
    { id: "c", folderId: "Work/Plans/Old", order: 30 },
  ]);
  assert.equal(snap.parentId, null);
  assert.equal(snapshotFolder(tree, notes, "Nope"), null);
  assert.equal(snapshotFolder(tree, notes, "Work/Plans")?.parentId, "Work");
});

test("undo puts the folders and every note back where they were, with the ranks", () => {
  const snap = snapshotFolder(tree, notes, "Work");
  assert.ok(snap);
  // after the delete: the folder and its subfolders are gone and the notes sit at the root
  const now = [f("Home"), f("Work 2")];
  const moved = notes.map((n) => (n.id <= "c" ? { ...n, folderId: null } : n));
  const plan = planRestore(snap, now, moved);
  assert.ok(!("problem" in plan));
  assert.deepEqual(
    plan.folders.map((x) => [x.id, x.order]),
    [
      ["Work", 1],
      ["Work/Plans", 2],
      ["Work/Plans/Old", 3],
      ["Work/Misc", undefined],
    ],
  );
  assert.deepEqual(plan.moves, snap.notes);
});

test("undo leaves a note alone that was moved on or trashed since, and never moves a note that was always at the root", () => {
  const snap = snapshotFolder(tree, notes, "Work/Plans");
  assert.ok(snap);
  // Plans went up to Work: b and c moved to Work; since then c went to Home and b was trashed
  const now = [f("Work"), f("Work/Misc"), f("Home")];
  const there = [note("a", "Work"), note("c", "Home"), note("x", "Work")];
  const plan = planRestore(snap, now, there);
  assert.ok(!("problem" in plan));
  assert.deepEqual(plan.moves, []);
  const back = planRestore(snap, now, [note("b", "Work"), note("c", "Work")]);
  assert.ok(!("problem" in back));
  assert.deepEqual(
    back.moves.map((m) => m.id),
    ["b", "c"],
  );
});

test("undo is refused when it cannot be exact: the name is taken (any case) or the parent is gone", () => {
  const snap = snapshotFolder(tree, notes, "Work/Plans");
  assert.ok(snap);
  const taken = planRestore(snap, [f("Work"), f("Work/plans")], []);
  assert.deepEqual(taken, {
    problem: 'A folder named "Plans" already exists here.',
  });
  const orphan = planRestore(snap, [f("Home")], []);
  assert.deepEqual(orphan, {
    problem: "The folder it was in no longer exists.",
  });
  // a folder of the same name in another place is no clash
  const other = planRestore(snap, [f("Work"), f("Home/Plans")], []);
  assert.ok(!("problem" in other));
});

test("a folder cannot be moved into itself, a folder inside it, its own parent, or a place where the name is taken", () => {
  assert.match(moveProblem(tree, "Work", "Work") ?? "", /itself/);
  assert.match(moveProblem(tree, "Work", "Work/Plans/Old") ?? "", /itself/);
  assert.equal(moveProblem(tree, "Work/Plans", "Work"), "It is already there.");
  assert.equal(moveProblem(tree, "Work", null), "It is already there.");
  assert.match(moveProblem(tree, "Work/Plans", "Gone") ?? "", /gone/);
  // "Work 2" only starts like "Work": it is a legal target
  assert.equal(moveProblem(tree, "Work", "Work 2"), null);
  assert.equal(moveProblem(tree, "Work/Plans", null), null);
  assert.equal(moveProblem(tree, "Work/Plans", "Home"), null);
  const clash = [...tree, f("Home/Plans")];
  assert.equal(
    moveProblem(clash, "Work/Plans", "Home"),
    'A folder named "Plans" already exists here.',
  );
  assert.equal(
    moveProblem([...tree, f("plans")], "Work/Plans", null),
    'A folder named "Plans" already exists here.',
  );
});

test("a moved folder takes what is under it along, loses its rank in the new parent and keeps the ranks below it", () => {
  const out = movedFolders(tree, "Work/Plans", "Home/Plans");
  const byId = new Map(out.map((x) => [x.id, x]));
  assert.deepEqual([...byId.keys()].sort(), [
    "Home",
    "Home/Plans",
    "Home/Plans/Old",
    "Work",
    "Work 2",
    "Work/Misc",
  ]);
  assert.equal(byId.get("Home/Plans")?.parentId, "Home");
  assert.equal(byId.get("Home/Plans")?.name, "Plans");
  assert.equal(byId.get("Home/Plans")?.order, undefined);
  assert.equal(byId.get("Home/Plans/Old")?.parentId, "Home/Plans");
  assert.equal(byId.get("Home/Plans/Old")?.order, 3);
  // a rename keeps the rank, and a folder to the root has no parent
  assert.equal(
    movedFolders(tree, "Work", "Job").find((x) => x.id === "Job")?.order,
    1,
  );
  assert.equal(
    movedFolders(tree, "Work/Plans", "Plans").find((x) => x.id === "Plans")
      ?.parentId,
    null,
  );
});

test("notes follow the folder they are in, and a folder that only starts with the same letters is left alone", () => {
  assert.equal(reId("Work/Plans", "Work", "Job"), "Job/Plans");
  assert.equal(reId("Work", "Work", "Job"), "Job");
  assert.equal(reId("Work 2", "Work", "Job"), "Work 2");
  assert.equal(reId(null, "Work", "Job"), null);
});

test("moving a folder to another depth relinks the pictures of every note under it, as moving a note does", () => {
  // Work/Plans/Old (3 deep) moves to Old (1 deep): the notes in it and below it change depth by 2
  const oldId = "Work/Plans/Old";
  const newId = "Old";
  const link = (depth: number) =>
    `![x](${"../".repeat(depth)}attachments/p.png)`;
  const inFolder = { folderId: oldId, body: link(3) };
  const below = { folderId: `${oldId}/Deep`, body: link(4) };
  for (const n of [inFolder, below]) {
    const to = reId(n.folderId, oldId, newId);
    assert.ok(to);
    const want = link(to.split("/").length);
    assert.equal(relinkAttachments(n.body, n.folderId, to), want);
  }
  // the same depth (a rename, or a move between siblings of equal depth) leaves the text as it is
  assert.equal(
    relinkAttachments(
      link(3),
      "Work/Plans/Old",
      reId("Work/Plans/Old", "Work/Plans", "Home/Plans"),
    ),
    link(3),
  );
  // a note moved to the vault root links without any "../"
  assert.equal(
    relinkAttachments(link(1), "Work", null),
    "![x](attachments/p.png)",
  );
});

test("the chain of a folder is itself and every folder above it, nearest first", () => {
  assert.deepEqual(folderChain("A/B/C"), ["A/B/C", "A/B", "A"]);
  assert.deepEqual(folderChain("A"), ["A"]);
  assert.deepEqual(folderChain(null), []);
});
