// src/lib/dragDrop.ts
// Shared by the drags that reorder rows (notes and folders in the sidebar, tasks, to-do lists and their groups):
// the row a dragged one would land next to carries data-drop="before|after" (styles in _DragDrop.scss).

// The one row that carries the line. Remembered, because a search of the whole document for `[data-drop]` on every frame of a
// drag costs a walk over every node (480k in a 50k-note vault)
let marked: HTMLElement | null = null;

export function clearDropMarks(): void {
  marked?.removeAttribute("data-drop");
  marked = null;
}

/** Lets the click that follows the release of a drag go to nobody: it would otherwise open or select the row the drag started on. */
export function swallowNextClick(): void {
  const block = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener("click", block, { capture: true, once: true });
  // No click comes when nothing was pressed and released on the same ancestor: do not block a later, real one
  setTimeout(() => window.removeEventListener("click", block, true), 0);
}

/** Marks `el` (or nothing) as the row the dragged one lands before, or after it when `after`. */
export function markDrop(el: HTMLElement | null, after = false): void {
  if (marked !== el) clearDropMarks();
  if (!el) return;
  marked = el;
  el.dataset.drop = after ? "after" : "before";
}
