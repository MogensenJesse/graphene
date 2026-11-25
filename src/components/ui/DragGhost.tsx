// src/components/ui/DragGhost.tsx
import { useLayoutEffect, useRef } from "react";
import { useDragValue } from "../../hooks/useDragToFolder";
import type { DragStore } from "../../lib/dragStore";

/**
 * The label that follows the pointer while a row is dragged (styles in _DragDrop.scss). The pointer is written onto the element
 * itself, so a frame of the drag renders nothing; the component renders when the drag starts and ends.
 */
function DragGhost({ drag }: { drag: DragStore }) {
  const label = useDragValue(drag, (view) => view.source?.label ?? null);
  const shown = label !== null;
  const ghost = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `shown` is the trigger: the element exists only while a drag runs
  useLayoutEffect(() => {
    const el = ghost.current;
    if (!el) return;
    const place = ({ x, y }: { x: number; y: number }) => {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    place(drag.pointer());
    return drag.follow(place);
  }, [drag, shown]);

  return shown ? (
    <div ref={ghost} className="drag-ghost" aria-hidden="true">
      {label}
    </div>
  ) : null;
}

export default DragGhost;
