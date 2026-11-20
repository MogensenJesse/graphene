// src/hooks/useDragToFolder.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { clearDropMarks, markDrop } from "../lib/dragDrop";
import { useLatest } from "./useLatest";

// Notes and tasks (and to-do lists) land next to any peer or as a whole on a container; folders and groups only among their siblings
type DragKind = "item" | "folder" | "task" | "taskList" | "taskGroup";
const siblingsOnly = (kind: DragKind) =>
  kind === "folder" || kind === "taskGroup";

/** What is dragged. A folder (or group) can only be put among its siblings: those whose parent id is `parent` ("" for the root). */
interface DragSource {
  kind: DragKind;
  id: string;
  label: string;
  parent?: string;
}

interface DragState extends DragSource {
  x: number;
  y: number;
}

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

export function useDragToFolder(onDrop: DropHandler): {
  dragState: DragState | null;
  dragOverId: string | null | undefined;
  startDrag: (e: React.PointerEvent, source: DragSource) => void;
} {
  const [dragState, setDragState] = useState<DragState | null>(null);
  // undefined = no active target, null = unfiled zone, string = folder id (or the trash).
  // Only a note dropped as a whole has one: with a line showing, or for a folder, there is no tint.
  const [dragOverId, setDragOverId] = useState<string | null | undefined>(
    undefined,
  );

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

      const handleMove = (ev: PointerEvent) => {
        if (!active) {
          if (
            Math.hypot(ev.clientX - start.x, ev.clientY - start.y) <
            DRAG_THRESHOLD_PX
          )
            return;
          active = true;
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
          setDragState({ ...source, x: ev.clientX, y: ev.clientY });
        }

        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        const x = ev.clientX;
        const y = ev.clientY;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setDragState((prev) => (prev ? { ...prev, x, y } : null));
          const { target, near, mark } = locate(x, y, source);
          markDrop(near ? mark : null, near?.after);
          setDragOverId(
            !siblingsOnly(source.kind) && !near ? target : undefined,
          );
        });
      };

      const stop = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        cleanupRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        clearDropMarks();
      };

      const handleUp = (ev: PointerEvent) => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (active) {
          const { target, near } = locate(ev.clientX, ev.clientY, source);
          if (near || (!siblingsOnly(source.kind) && target !== undefined))
            onDropRef.current(source, target, near);
        }
        setDragState(null);
        setDragOverId(undefined);
        stop();
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      cleanupRef.current = stop;
    },
    [onDropRef],
  );

  return { dragState, dragOverId, startDrag };
}
