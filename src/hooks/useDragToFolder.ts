// src/hooks/useDragToFolder.ts
import { useCallback, useEffect, useRef, useState } from "react";

export interface DragState {
  itemId: string;
  label: string;
  x: number;
  y: number;
}

// Scans elements at a point for the nearest one with data-folder-drop-id.
// Returns: undefined = no target, null = unfiled zone, string = folder id
function getFolderDropTarget(x: number, y: number): string | null | undefined {
  const els = document.elementsFromPoint(x, y) as HTMLElement[];
  for (const el of els) {
    const attr = el.getAttribute("data-folder-drop-id");
    if (attr !== null) {
      return attr === "unfiled" ? null : attr;
    }
  }
  return undefined;
}

const DRAG_THRESHOLD_PX = 6;

export function useDragToFolder(
  onMove: (itemId: string, targetFolderId: string | null) => void,
): {
  dragState: DragState | null;
  dragOverId: string | null | undefined;
  startDrag: (e: React.PointerEvent, itemId: string, label: string) => void;
} {
  const [dragState, setDragState] = useState<DragState | null>(null);
  // undefined = no active target, null = unfiled zone, string = folder id
  const [dragOverId, setDragOverId] = useState<string | null | undefined>(
    undefined,
  );

  const pendingRef = useRef<{ itemId: string; label: string } | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
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
    (e: React.PointerEvent, itemId: string, label: string) => {
      if (e.button !== 0) return;
      e.preventDefault();

      pendingRef.current = { itemId, label };
      startPosRef.current = { x: e.clientX, y: e.clientY };

      let active = false;

      const handleMove = (ev: PointerEvent) => {
        if (!startPosRef.current) return;
        const dist = Math.hypot(
          ev.clientX - startPosRef.current.x,
          ev.clientY - startPosRef.current.y,
        );

        if (!active) {
          if (dist < DRAG_THRESHOLD_PX) return;
          active = true;
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
          if (pendingRef.current) {
            setDragState({
              itemId: pendingRef.current.itemId,
              label: pendingRef.current.label,
              x: ev.clientX,
              y: ev.clientY,
            });
          }
        }

        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        const x = ev.clientX;
        const y = ev.clientY;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setDragState((prev) => (prev ? { ...prev, x, y } : null));
          setDragOverId(getFolderDropTarget(x, y));
        });
      };

      const handleUp = (ev: PointerEvent) => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (active) {
          const target = getFolderDropTarget(ev.clientX, ev.clientY);
          if (target !== undefined && pendingRef.current) {
            onMove(pendingRef.current.itemId, target);
          }
        }

        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setDragState(null);
        setDragOverId(undefined);
        pendingRef.current = null;
        startPosRef.current = null;
        active = false;

        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        cleanupRef.current = null;
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      cleanupRef.current = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };
    },
    [onMove],
  );

  return { dragState, dragOverId, startDrag };
}
