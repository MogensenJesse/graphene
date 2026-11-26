// src/lib/dragScroll.ts
// Scrolling a list while a row is dragged with a finger: there is no wheel under it, so the list moves when the finger is near its
// top or bottom edge.

/** How close to an edge the finger has to be for the list to move. */
export const EDGE_PX = 56;
/** The most the list moves in one frame (at the edge or past it). */
const MAX_STEP_PX = 16;

/**
 * How far the list moves this frame for a finger at `y` in a box from `top` to `bottom`: negative is up, 0 away from both edges.
 * The nearer the edge, the faster.
 */
export function edgeStep(y: number, top: number, bottom: number): number {
  const up = (top + EDGE_PX - y) / EDGE_PX;
  if (up > 0) return -Math.ceil(Math.min(up, 1) * MAX_STEP_PX);
  const down = (y - (bottom - EDGE_PX)) / EDGE_PX;
  if (down > 0) return Math.ceil(Math.min(down, 1) * MAX_STEP_PX);
  return 0;
}

/** The nearest ancestor of `el` that scrolls up and down and has something to scroll. */
export function scrollParentOf(el: Element | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const overflow = getComputedStyle(p).overflowY;
    if (
      (overflow === "auto" || overflow === "scroll") &&
      p.scrollHeight > p.clientHeight
    )
      return p;
  }
  return null;
}
