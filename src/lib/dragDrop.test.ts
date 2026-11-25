// src/lib/dragDrop.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { clearDropMarks, markDrop } from "./dragDrop";

/** Just enough of an element: `dataset` and `removeAttribute("data-drop")`. */
function row() {
  const dataset: Record<string, string> = {};
  const el = {
    dataset,
    removeAttribute: (name: string) => {
      delete dataset[name.replace(/^data-/, "")];
    },
  };
  return el as unknown as HTMLElement;
}

test("only the row the dragged one lands next to carries the line, before or after it", () => {
  const a = row();
  const b = row();
  markDrop(a, false);
  assert.equal(a.dataset.drop, "before");
  markDrop(a, true); // same row, the pointer crossed its middle
  assert.equal(a.dataset.drop, "after");
  markDrop(b);
  assert.equal(a.dataset.drop, undefined);
  assert.equal(b.dataset.drop, "before");
  markDrop(null);
  assert.equal(b.dataset.drop, undefined);
});

test("clearing takes the line off and is safe when there is none", () => {
  const a = row();
  markDrop(a, true);
  clearDropMarks();
  assert.equal(a.dataset.drop, undefined);
  clearDropMarks();
});
