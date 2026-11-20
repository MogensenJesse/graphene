// src/lib/dragDrop.ts
// Shared by the drags that reorder rows (notes and folders in the sidebar, tasks, to-do lists and their groups):
// the row a dragged one would land next to carries data-drop="before|after" (styles in _DragDrop.scss).

export function clearDropMarks(): void {
  for (const el of document.querySelectorAll("[data-drop]"))
    el.removeAttribute("data-drop");
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
  clearDropMarks();
  if (el) el.dataset.drop = after ? "after" : "before";
}
