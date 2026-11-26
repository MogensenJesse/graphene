// src/lib/dragScroll.test.ts
import { describe, expect, it } from "vitest";
import { EDGE_PX, edgeStep } from "./dragScroll";

describe("edgeStep", () => {
  it("does not move the list away from the edges", () => {
    expect(edgeStep(300, 100, 700)).toBe(0);
    expect(edgeStep(100 + EDGE_PX, 100, 700)).toBe(0);
    expect(edgeStep(700 - EDGE_PX, 100, 700)).toBe(0);
  });

  it("moves up near the top and down near the bottom, faster the nearer the edge", () => {
    const slow = edgeStep(100 + EDGE_PX - 10, 100, 700);
    const fast = edgeStep(100 + 5, 100, 700);
    expect(slow).toBeLessThan(0);
    expect(fast).toBeLessThan(slow);
    expect(edgeStep(700 - EDGE_PX + 10, 100, 700)).toBeGreaterThan(0);
    expect(edgeStep(700 - 5, 100, 700)).toBeGreaterThan(
      edgeStep(700 - EDGE_PX + 10, 100, 700),
    );
  });

  it("stops accelerating at the edge and past it", () => {
    expect(edgeStep(100, 100, 700)).toBe(edgeStep(20, 100, 700));
    expect(edgeStep(700, 100, 700)).toBe(edgeStep(900, 100, 700));
  });
});
