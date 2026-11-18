// src/lib/order.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { compareFoldersManual, compareItemsManual, placeNear } from "./order";

const r = (id: string, order?: number) => ({ id, order });

test("ranked notes come first in rank order, the rest follow by name", () => {
  const item = (title: string, order?: number) => ({
    id: title,
    title,
    body: "",
    folderId: null,
    createdAt: "",
    updatedAt: "",
    order,
  });
  const sorted = [
    item("b"),
    item("a"),
    item("z", 1),
    item("y", 2),
    item("m", 1),
  ].sort(compareItemsManual);
  assert.deepEqual(
    sorted.map((i) => i.title),
    ["m", "z", "y", "a", "b"], // equal ranks fall back to the name
  );
  const f = (name: string, order?: number) => ({
    id: name,
    name,
    parentId: null,
    createdAt: "",
    order,
  });
  assert.deepEqual(
    [f("B"), f("A", 5), f("C", 1)].sort(compareFoldersManual).map((x) => x.id),
    ["C", "A", "B"],
  );
});

test("placing between two ranked neighbours writes one rank, the middle", () => {
  const list = [r("a", 1024), r("b", 2048), r("c", 3072)];
  assert.deepEqual(placeNear(list, "c", "b", false), { c: 1536 }); // before b
  assert.deepEqual(placeNear(list, "a", "b", true), { a: 2560 }); // after b
});

test("placing at either end steps away from the neighbour", () => {
  const list = [r("a", 1024), r("b", 2048)];
  assert.deepEqual(placeNear(list, "b", "a", false), { b: 0 });
  assert.deepEqual(placeNear(list, "a", "b", true), { a: 3072 });
});

test("a note from another folder is placed among the siblings", () => {
  const list = [r("a", 1024), r("b", 2048)];
  assert.deepEqual(placeNear(list, "x", "a", true), { x: 1536 });
  assert.deepEqual(placeNear([r("a", 1024)], "x", "a", true), { x: 2048 });
});

test("a drop that changes nothing writes nothing", () => {
  const list = [r("a", 1), r("b", 2), r("c", 3)];
  assert.deepEqual(placeNear(list, "b", "a", true), {}); // already after a
  assert.deepEqual(placeNear(list, "b", "c", false), {}); // already before c
  assert.deepEqual(placeNear(list, "a", "zzz", false), {}); // unknown target
});

test("unranked neighbours, a full gap or a list shown by name renumber the list", () => {
  // the moved note's own missing rank does not matter: it only needs a rank before a
  assert.deepEqual(placeNear([r("a", 5), r("b", 6), r("c")], "c", "a", false), {
    c: 5 - 1024,
  });
  // its new neighbour c has no rank yet: number everything in the new order
  assert.deepEqual(placeNear([r("a", 5), r("b", 6), r("c")], "a", "b", true), {
    b: 1024,
    a: 2048,
    c: 3072,
  });
  // two ranks too close to share a third
  assert.deepEqual(
    placeNear([r("a", 1), r("b", 1 + 1e-9), r("c", 9)], "c", "b", false),
    { a: 1024, c: 2048, b: 3072 },
  );
  // shown by name: ranks (if any) are ignored, only changed ones come back
  assert.deepEqual(placeNear([r("a"), r("b"), r("c")], "c", "a", false, true), {
    c: 1024,
    a: 2048,
    b: 3072,
  });
  assert.deepEqual(
    placeNear(
      [r("a", 1024), r("b", 2048), r("c", 3072), r("d", 5000)],
      "d",
      "c",
      false,
      true,
    ),
    { d: 3072, c: 4096 }, // a and b already have the rank they would get
  );
});
