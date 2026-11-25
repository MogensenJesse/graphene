// src/components/ui/ColumnResizer.tsx
import { useRef, useState } from "react";
import { useEscape } from "../../hooks/useEscape";
import {
  applyNoteWidth,
  clampWidth,
  DEFAULT_WIDTH,
  getNoteWidth,
  MAX_WIDTH,
  MIN_WIDTH,
  saveNoteWidth,
  widthAfterDrag,
} from "../../lib/columnWidth";

type Edge = "left" | "right";

interface Drag {
  edge: Edge;
  x: number; // where the pointer went down
  shown: number; // the column's width then (the pane may cap it below the saved one)
  saved: number; // the width that was saved, to put back on Escape
  width: number; // the width now
}

const KEY_STEP = 16;
const KEY_STEP_BIG = 64;

/**
 * The two edges of a note's text column, to drag it wider or narrower (the same for every note; see lib/columnWidth). It goes inside
 * the box of the note's text (the reading view's column, the editor's writing box) and fills it, so the strips are as tall as the
 * note and not the whole pane, and a little outside the text, so the line that shows is not touching it. The column stays
 * centred, so one edge going out takes the other with it. While dragging the width is written straight to <html> and nothing
 * renders again; it is kept when the pointer is let go, and Escape puts it back. Double-click goes back to the default width. The
 * right edge is also a keyboard separator: the arrow keys change the width (Shift for a bigger step).
 */
function ColumnResizer() {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [width, setWidth] = useState(getNoteWidth);
  const [edge, setEdge] = useState<Edge | null>(null); // the edge being dragged

  const show = (w: number) => {
    applyNoteWidth(w);
    setWidth(w);
  };
  const finish = (keep: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setEdge(null);
    if (keep) saveNoteWidth(d.width);
    else show(d.saved);
  };
  useEscape(() => finish(false), { active: edge !== null, capture: true });

  const start = (e: React.PointerEvent<HTMLDivElement>, which: Edge) => {
    if (e.button !== 0) return;
    e.preventDefault(); // no text selection while dragging
    e.currentTarget.setPointerCapture(e.pointerId);
    const shown = Math.round(
      track.current?.getBoundingClientRect().width ?? width,
    );
    drag.current = { edge: which, x: e.clientX, shown, saved: width, width };
    setEdge(which);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.width = widthAfterDrag(d.shown, e.clientX - d.x, d.edge);
    show(d.width);
  };
  const reset = () => {
    saveNoteWidth(DEFAULT_WIDTH);
    setWidth(DEFAULT_WIDTH);
  };

  const edgeProps = (which: Edge) => ({
    className: `column-resizer__edge column-resizer__edge--${which}${edge === which ? " column-resizer__edge--drag" : ""}`,
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => start(e, which),
    onPointerMove: move,
    onPointerUp: () => finish(true),
    onPointerCancel: () => finish(true),
    onDoubleClick: reset,
  });

  return (
    // The layer is the column's own box, so its width is the width the column is drawn at (the pane may cap it below the saved one)
    <div ref={track} className="column-resizer">
      <div {...edgeProps("left")} aria-hidden="true" />
      {/* biome-ignore lint/a11y/useSemanticElements: a window splitter is a focusable separator; <hr> cannot take the focus */}
      <div
        {...edgeProps("right")}
        role="separator"
        aria-orientation="vertical"
        aria-label="Text width"
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        tabIndex={0}
        onKeyDown={(e) => {
          const step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP;
          const to =
            e.key === "ArrowRight"
              ? width + step
              : e.key === "ArrowLeft"
                ? width - step
                : null;
          if (to === null) return;
          e.preventDefault();
          const next = clampWidth(to);
          saveNoteWidth(next);
          setWidth(next);
        }}
      />
    </div>
  );
}

export default ColumnResizer;
