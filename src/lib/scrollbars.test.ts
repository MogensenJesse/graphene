// src/lib/scrollbars.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { scrollTopAfterDrag, thumbMetrics } from "./scrollbars";

test("nothing scrolls, no thumb", () => {
  assert.equal(thumbMetrics(0, 500, 500, 496), null);
  assert.equal(thumbMetrics(0, 500, 501, 496), null);
  assert.equal(thumbMetrics(0, 500, 900, 0), null);
});

test("the thumb is as long as the visible share of the content, never under 28px", () => {
  const half = thumbMetrics(0, 500, 1000, 496);
  assert.equal(half?.size, 248);
  assert.equal(half?.offset, 0);
  assert.equal(thumbMetrics(0, 500, 100000, 496)?.size, 28);
});

test("the thumb rides from the top of the track to its bottom with the scroll", () => {
  const top = thumbMetrics(0, 500, 1000, 496);
  const middle = thumbMetrics(250, 500, 1000, 496);
  const bottom = thumbMetrics(500, 500, 1000, 496);
  assert.equal(top?.offset, 0);
  assert.equal(middle?.offset, 124);
  assert.equal(bottom?.offset, 496 - 248);
  // overscroll (elastic or a late resize) stays on the track
  assert.equal(thumbMetrics(900, 500, 1000, 496)?.offset, 248);
  assert.equal(thumbMetrics(-40, 500, 1000, 496)?.offset, 0);
});

test("dragging the thumb by its whole room scrolls the whole way, and never past the ends", () => {
  // 1000 of content in 500 of view, thumb 248 in a track of 496: 248 px of room for 500 px of scroll
  assert.equal(scrollTopAfterDrag(0, 248, 500, 1000, 248, 496), 500);
  assert.equal(scrollTopAfterDrag(0, 124, 500, 1000, 248, 496), 250);
  assert.equal(scrollTopAfterDrag(100, 9999, 500, 1000, 248, 496), 500);
  assert.equal(scrollTopAfterDrag(100, -9999, 500, 1000, 248, 496), 0);
  // a thumb that fills the track cannot move
  assert.equal(scrollTopAfterDrag(7, 50, 500, 1000, 496, 496), 7);
});
