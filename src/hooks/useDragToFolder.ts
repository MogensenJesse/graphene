// src/hooks/useDragToFolder.ts
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { clearDropMarks, markDrop, swallowNextClick } from "../lib/dragDrop";
import { edgeStep, scrollParentOf } from "../lib/dragScroll";
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
// A finger picks a row up by resting on it for this long (the row's long-press menu comes at about 500 ms, so this is first)
const HOLD_MS = 400;
// A finger that moves this far before that is scrolling; after it, this far is a drag (less is a finger that rested)
const HOLD_SLOP_PX = 10;

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
      // A finger keeps its own behaviour (the scroll, the tap) until the row is picked up
      const touch = e.pointerType === "touch";
      if (!touch) e.preventDefault();

      const pointerId = e.pointerId;
      const row = e.currentTarget;
      const start = { x: e.clientX, y: e.clientY };
      let at = start;
      let active = false;
      // Escape was pressed: the drag is over, but the button is still down until it is released
      let cancelled = false;
      // Touch: the finger has rested long enough, so the row is picked up (a mouse is "held" at once)
      let held = !touch;
      // Touch: the finger has moved since the row was picked up. One that rested and lifted made a long press: the row's own menu
      let dragged = false;
      let holdTimer: number | null = null;
      let edgeRaf: number | null = null;
      let scroller: HTMLElement | null = null;

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

      // The drag runs: the ghost, the grabbing cursor and the key that cancels it
      const begin = (x: number, y: number) => {
        active = true;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        // The pointer first: the ghost mounts with the view and starts where it is
        drag.movePointer(x, y);
        drag.set({ source, overId: undefined });
        window.addEventListener("keydown", handleKey, true);
      };

      // The ghost, the drop line and the tint follow the pointer (also when the list moved under a finger that did not)
      const place = (x: number, y: number) => {
        drag.movePointer(x, y);
        const { target, near, mark } = locate(x, y, source);
        markDrop(near ? mark : null, near?.after);
        drag.set({
          source,
          overId: !siblingsOnly(source.kind) && !near ? target : undefined,
        });
      };

      // A finger near the top or bottom of the list moves it, a frame at a time while it stays there
      const edgeScroll = () => {
        edgeRaf = null;
        if (!active || cancelled || !scroller) return;
        const box = scroller.getBoundingClientRect();
        const step = edgeStep(at.y, box.top, box.bottom);
        if (!step) return;
        const before = scroller.scrollTop;
        scroller.scrollTop += step;
        if (scroller.scrollTop === before) return;
        place(at.x, at.y);
        edgeRaf = requestAnimationFrame(edgeScroll);
      };

      const handleMove = (ev: PointerEvent) => {
        if (cancelled || (touch && ev.pointerId !== pointerId)) return;
        at = { x: ev.clientX, y: ev.clientY };
        if (!held) {
          // The finger moved before it had rested long enough: it is scrolling, and the row is not for dragging
          if (Math.hypot(at.x - start.x, at.y - start.y) > HOLD_SLOP_PX) stop();
          return;
        }
        if (!active) {
          if (Math.hypot(at.x - start.x, at.y - start.y) < DRAG_THRESHOLD_PX)
            return;
          begin(at.x, at.y);
        }
        if (touch) {
          if (Math.hypot(at.x - start.x, at.y - start.y) > HOLD_SLOP_PX)
            dragged = true;
          if (edgeRaf === null) edgeRaf = requestAnimationFrame(edgeScroll);
        }

        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        const { x, y } = at;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          place(x, y);
        });
      };

      // Picked up: the finger rested on the row, so the touch is the drag's from here (the scroll is held back, and so is
      // the long-press menu: its event comes about 100 ms later)
      const blockScroll = (ev: TouchEvent) => {
        if (held && ev.cancelable) ev.preventDefault();
      };
      const blockMenu = (ev: Event) => {
        if (!held) return;
        ev.preventDefault();
        ev.stopPropagation();
      };

      const stop = () => {
        if (holdTimer !== null) clearTimeout(holdTimer);
        if (edgeRaf !== null) cancelAnimationFrame(edgeRaf);
        holdTimer = edgeRaf = null;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", abort);
        window.removeEventListener("blur", abort);
        window.removeEventListener("keydown", handleKey, true);
        window.removeEventListener("touchmove", blockScroll);
        window.removeEventListener("contextmenu", blockMenu, true);
        cleanupRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        clearDropMarks();
      };

      // The release was lost (the system took the pointer, the window lost the focus): end the drag, drop nothing
      const abort = (ev?: Event) => {
        if (touch && ev instanceof PointerEvent && ev.pointerId !== pointerId)
          return;
        reset();
        stop();
      };

      const handleUp = (ev: PointerEvent) => {
        if (touch && ev.pointerId !== pointerId) return;
        reset();
        let menu = false;
        if (active && !cancelled) {
          if (touch && !dragged) menu = true;
          else {
            const { target, near } = locate(ev.clientX, ev.clientY, source);
            if (near || (!siblingsOnly(source.kind) && target !== undefined))
              onDropRef.current(source, target, near);
          }
        }
        // The click that follows the release would open or select what the drag started on
        if (active) swallowNextClick();
        stop();
        // The long press that was held back for the drag: now the row's own menu
        if (menu)
          row.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              button: 2,
              clientX: ev.clientX,
              clientY: ev.clientY,
              view: window,
            }),
          );
      };

      if (touch) {
        holdTimer = window.setTimeout(() => {
          holdTimer = null;
          held = true;
          scroller = scrollParentOf(row as Element);
          begin(at.x, at.y);
        }, HOLD_MS);
        // Blocking (not passive), or the browser scrolls before the page can say no
        window.addEventListener("touchmove", blockScroll, { passive: false });
        window.addEventListener("contextmenu", blockMenu, true);
      }
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
