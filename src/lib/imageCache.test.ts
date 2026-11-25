// src/lib/imageCache.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { createImageCache } from "./imageCache";

function setup(maxEntries: number, maxBytes: number) {
  const disposed: string[] = [];
  const cache = createImageCache((u) => disposed.push(u), maxEntries, maxBytes);
  return { cache, disposed };
}

test("a hit returns the cached url and keeps it", () => {
  const { cache, disposed } = setup(4, 100);
  assert.equal(cache.acquire("a"), undefined);
  assert.equal(cache.has("a"), false);
  assert.equal(cache.put("a", "blob:a", 10), "blob:a");
  assert.equal(cache.has("a"), true);
  cache.release("a");
  assert.equal(cache.acquire("a"), "blob:a");
  assert.deepEqual(disposed, []);
  assert.equal(cache.size, 1);
  assert.equal(cache.bytes, 10);
});

test("evicts the least recently used by count", () => {
  const { cache, disposed } = setup(2, 1000);
  for (const k of ["a", "b"]) {
    cache.put(k, `blob:${k}`, 1);
    cache.release(k);
  }
  cache.acquire("a"); // a is now newer than b
  cache.release("a");
  cache.put("c", "blob:c", 1);
  cache.release("c");
  assert.deepEqual(disposed, ["blob:b"]);
  assert.equal(cache.acquire("b"), undefined);
  assert.equal(cache.size, 2);
});

test("evicts by total bytes, oldest first", () => {
  const { cache, disposed } = setup(10, 100);
  for (const k of ["a", "b", "c"]) {
    cache.put(k, `blob:${k}`, 40);
    cache.release(k);
  }
  // 120 bytes > 100: a (the oldest) went
  assert.deepEqual(disposed, ["blob:a"]);
  assert.equal(cache.bytes, 80);
  // one big picture pushes out as many as it takes
  cache.put("d", "blob:d", 90);
  cache.release("d");
  assert.deepEqual(disposed, ["blob:a", "blob:b", "blob:c"]);
  assert.equal(cache.size, 1);
  assert.equal(cache.bytes, 90);
});

test("a picture that is shown is never evicted, and goes when released", () => {
  const { cache, disposed } = setup(1, 100);
  cache.put("a", "blob:a", 10); // held: an <img> shows it
  cache.put("b", "blob:b", 10); // over the count, but a is held and b is held
  assert.deepEqual(disposed, []);
  assert.equal(cache.size, 2);
  cache.release("a");
  assert.deepEqual(disposed, ["blob:a"]);
  assert.equal(cache.acquire("b"), "blob:b");
  // two <img> on the same picture: it stays until both let go
  cache.release("b");
  cache.release("b");
  assert.deepEqual(disposed, ["blob:a"]); // size 1 is within the cap: b stays cached
  cache.put("c", "blob:c", 10);
  cache.release("c");
  assert.deepEqual(disposed, ["blob:a", "blob:b"]);
});

test("one held picture over the byte cap survives until released", () => {
  const { cache, disposed } = setup(10, 50);
  cache.put("big", "blob:big", 80);
  assert.deepEqual(disposed, []);
  cache.release("big");
  assert.deepEqual(disposed, ["blob:big"]);
  assert.equal(cache.size, 0);
  assert.equal(cache.bytes, 0);
});

test("putting a key that is cached keeps the first url and disposes the new one", () => {
  const { cache, disposed } = setup(4, 100);
  cache.put("a", "blob:1", 10);
  assert.equal(cache.put("a", "blob:2", 10), "blob:1");
  assert.deepEqual(disposed, ["blob:2"]);
  assert.equal(cache.bytes, 10); // counted once
  cache.release("a");
  cache.release("a");
  cache.release("a"); // extra releases are harmless
  assert.equal(cache.acquire("a"), "blob:1");
});
