// src/hooks/useDragToFolder.ts
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { clearDropMarks, markDrop, swallowNextClick } from "../lib/dragDrop";
import {
  AT_REST,
  createDragStore,
  type DragKind,
  type DragSource,
  type DragStore,
  type DragView,
} from "../lib/dragStore";
import { useLatest } from "./useLatest";

const siblingsOnly = (kind: DragKind) =>
  kind === "folder" || kind === "taskGroup";

/** A row the dragged one would land next to: before it, or after it when `after`. */
export interface NearRow {
  id: string;
  after: boolean;
}

/**
 * Called when something is dropped. `target` is where a note lands as a whole: undefined = nowhere,
 * null = unfiled, TRASH_DROP_ID = trash, other string = folder id. `near` is set when it was dropped
 * between rows (any `kind` of drag); it wins over `target`.
 */
type DropHandler = (
  source: Pick<DragSource, "kind" | "id">,
  target: string | null | undefined,
  near: NearRow | null,
) => void;

// Drop id of the Trash button. Not a folder id (those are generated, never start with a dot), so
// the drop handler can tell "delete" from "move to folder".
export const TRASH_DROP_ID = ".trash";

/**
 * What is under the pointer. `target` is the nearest element with data-folder-drop-id. `near` is the nearest
 * row this drag can be placed next to: item rows and folder groups carry data-sort-kind, data-sort-id and
 * (folders) data-sort-parent. A folder group is judged by its header (its first child), so the whole
 * expanded body counts as "after". `mark` is the element that shows the line.
 */
function locate(
  x: number,
  y: number,
  source: DragSource,
): {
  target: string | null | undefined;
  near: NearRow | null;
  mark: HTMLElement | null;
} {
  let target: string | null | undefined;
  let near: NearRow | null = null;
  let mark: HTMLElement | null = null;
  for (const el of document.elementsFromPoint(x, y) as HTMLElement[]) {
    const drop = el.dataset.folderDropId;
    if (target === undefined && drop !== undefined)
      target = drop === "unfiled" ? null : drop;
    const id = el.dataset.sortId;
    if (
      !near &&
      id !== undefined &&
      id !== source.id &&
      el.dataset.sortKind === source.kind &&
      (!siblingsOnly(source.kind) || el.dataset.sortParent === source.parent)
    ) {
      const row = siblingsOnly(source.kind) ? (el.firstElementChild ?? el) : el;
      const r = row.getBoundingClientRect();
      near = { id, after: y > r.top + r.height / 2 };
      mark = el;
    }
  }
  return { target, near, mark };
}

const DRAG_THRESHOLD_PX = 6;

/**
 * Reads one part of a drag's view (the drop target a row draws, whether a note is being dragged): the component re-renders only
 * when that value changes, never for a frame of the drag. `pick` must give a plain value (a string, a boolean), not a new object.
 */
export function useDragValue<T>(
  store: DragStore,
  pick: (view: DragView) => T,
): T {
  return useSyncExternalStore(store.subscribe, () => pick(store.get()));
}

/**
 * The drag of a row (note, folder, task, to-do list, group). Its state is a store (see lib/dragStore), not React state: the
 * pointer moves are written onto the ghost directly and the drop line is a data attribute, so a frame of the drag renders nothing;
 * only a row that gains or loses the drop tint does, through `useDragValue`.
 */
export function useDragToFolder(onDrop: DropHandler): {
  drag: DragStore;
  startDrag: (e: React.PointerEvent, source: DragSource) => void;
} {
  const [drag] = useState(createDragStore);

  const onDropRef = useLatest(onDrop);
  const cleanupRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number | null>(null);

  // Clean up event listeners and any pending rAF on unmount
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (cleanupRef.current) cleanupRef.current();
    },
    [],
  );

  const startDrag = useCallback(
    (e: React.PointerEvent, source: DragSource) => {
      if (e.button !== 0) return;
      e.preventDefault();

      const start = { x: e.clientX, y: e.clientY };
      let active = false;
      // Escape was pressed: the drag is over, but the button is still down until it is released
      let cancelled = false;

      // Back to rest: no ghost, no tint, no line, no grabbing cursor
      const reset = () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        drag.set(AT_REST);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        clearDropMarks();
      };

      // While the drag runs the key is the drag's: the editor, the details pane or a picker under it must not
      // also react to the Escape that cancels it (this listener is first: window, capture)
      const handleKey = (ev: KeyboardEvent) => {
        if (ev.key !== "Escape") return;
        ev.preventDefault();
        ev.stopPropagation();
        if (cancelled) return;
        cancelled = true;
        reset();
      };

      const handleMove = (ev: PointerEvent) => {
        if (cancelled) return;
        if (!active) {
          if (
            Math.hypot(ev.clientX - start.x, ev.clientY - start.y) <
            DRAG_THRESHOLD_PX
          )
            return;
          active = true;
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
          // The pointer first: the ghost mounts with the view and starts where it is
          drag.movePointer(ev.clientX, ev.clientY);
          drag.set({ source, overId: undefined });
          window.addEventListener("keydown", handleKey, true);
        }

        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        const x = ev.clientX;
        const y = ev.clientY;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          drag.movePointer(x, y);
          const { target, near, mark } = locate(x, y, source);
          markDrop(near ? mark : null, near?.after);
          drag.set({
            source,
            overId: !siblingsOnly(source.kind) && !near ? target : undefined,
          });
        });
      };

      const stop = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", abort);
        window.removeEventListener("blur", abort);
        window.removeEventListener("keydown", handleKey, true);
        cleanupRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        clearDropMarks();
      };

      // The release was lost (the system took the pointer, the window lost the focus): end the drag, drop nothing
      const abort = () => {
        reset();
        stop();
      };

      const handleUp = (ev: PointerEvent) => {
        reset();
        if (active && !cancelled) {
          const { target, near } = locate(ev.clientX, ev.clientY, source);
          if (near || (!siblingsOnly(source.kind) && target !== undefined))
            onDropRef.current(source, target, near);
        }
        // The click that follows the release would open or select what the drag started on
        if (active) swallowNextClick();
        stop();
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", abort);
      window.addEventListener("blur", abort);
      cleanupRef.current = stop;
    },
    [drag, onDropRef],
  );

  return { drag, startDrag };
}
