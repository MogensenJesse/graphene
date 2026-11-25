// src/lib/dragStore.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { AT_REST, createDragStore, type DragSource } from "./dragStore";

const note: DragSource = { kind: "item", id: "a", label: "A" };

test("it rests until a drag starts, and listeners hear only of a change of source or target", () => {
  const store = createDragStore();
  assert.equal(store.get(), AT_REST);
  let heard = 0;
  const off = store.subscribe(() => heard++);

  store.set({ source: note, overId: undefined });
  assert.equal(heard, 1);
  // a frame that finds the same target changes nothing: no one re-renders
  store.set({ source: note, overId: undefined });
  assert.equal(heard, 1);
  store.set({ source: note, overId: "Work" });
  store.set({ source: note, overId: null }); // the unfiled zone is a target of its own
  assert.equal(heard, 3);
  assert.equal(store.get().overId, null);

  off();
  store.set(AT_REST);
  assert.equal(heard, 3);
  assert.equal(store.get().source, null);
});

test("the pointer goes to its followers only, and the last place is remembered for a ghost that mounts late", () => {
  const store = createDragStore();
  let heard = 0;
  store.subscribe(() => heard++);
  const seen: [number, number][] = [];
  const off = store.follow(({ x, y }) => seen.push([x, y]));

  store.movePointer(10, 20);
  store.movePointer(11, 22);
  assert.deepEqual(seen, [
    [10, 20],
    [11, 22],
  ]);
  assert.equal(heard, 0); // a frame of the drag is not a render
  assert.deepEqual(store.pointer(), { x: 11, y: 22 });

  off();
  store.movePointer(30, 40);
  assert.equal(seen.length, 2);
  assert.deepEqual(store.pointer(), { x: 30, y: 40 });
});

test("a listener that unsubscribes while it is being told does not break the others", () => {
  const store = createDragStore();
  const heard: string[] = [];
  const off = store.subscribe(() => {
    heard.push("first");
    off();
  });
  store.subscribe(() => heard.push("second"));
  store.set({ source: note, overId: undefined });
  store.set({ source: null, overId: undefined });
  assert.deepEqual(heard, ["first", "second", "second"]);
});
