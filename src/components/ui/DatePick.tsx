// src/components/ui/DatePick.tsx
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { useAnchorRect } from "../../hooks/useAnchorRect";
import { useEscape } from "../../hooks/useEscape";
import { placeBelow, visibleBounds } from "../../lib/popoverBounds";
import Calendar from "./Calendar";
import Tooltip from "./Tooltip";

const EDGE = 8; // keep this far from the edge of what the page can show
const GAP = 4; // between the button and the calendar

interface CalendarPopoverProps {
  /** Where the calendar opens: under this box, or above it when the window has no room below */
  anchor: DOMRect;
  /** The element `anchor` was measured from, if it can be measured again: the calendar follows it when the window is resized */
  anchorEl?: Element | null;
  /** The button that opened it, if any: a press on it is its own toggle, not a click outside */
  trigger?: Element | null;
  /** As wide as this (the button), but never narrower than the month needs, see `.calendar-pop` */
  width?: number;
  value: string;
  today: string;
  onPick: (day: string | null) => void;
  onClose: () => void;
}

const insidePopover = (target: EventTarget | null) =>
  target instanceof Element && target.closest(".calendar-pop") !== null;

/**
 * The calendar in a box over the page. It closes on a pick, Escape, a click elsewhere, losing the window or a scroll. A resize (a phone's
 * keyboard going up or down) places it again.
 */
function CalendarPopover({
  anchor,
  anchorEl,
  trigger,
  width,
  value,
  today,
  onPick,
  onClose,
}: CalendarPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Read during the first render, before the calendar takes the focus, so closing can hand it back
  const previous = useRef(document.activeElement);
  const rect = useAnchorRect(anchor, anchorEl ?? trigger, onClose);

  // Under the anchor, over it when there is more room there, or moved up to be seen whole: inside what the page can show (not under a
  // system bar or the keyboard), before the first paint
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const p = placeBelow(
      rect,
      { width: el.offsetWidth, height: el.offsetHeight },
      visibleBounds(EDGE),
      GAP,
    );
    el.style.left = `${p.left}px`;
    el.style.top = `${p.top}px`;
  }, [rect]);

  useEscape(onClose, { capture: true });

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!insidePopover(e.target) && !trigger?.contains(e.target as Node))
        onClose();
    };
    const onScroll = (e: Event) => {
      if (!insidePopover(e.target)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("blur", onClose);
    };
  }, [trigger, onClose]);

  // Hand the focus back to the button or row that opened it, unless the pick already put it somewhere else
  useEffect(() => {
    const el = previous.current;
    const box = ref.current;
    return () => {
      // React's development try-out unmount (StrictMode) runs this while the calendar is still on the page: moving the focus
      // then would blur the calendar and close it as it opens
      if (box?.isConnected) return;
      const now = document.activeElement;
      const taken = now && now !== document.body && !insidePopover(now);
      if (el instanceof HTMLElement && !taken)
        el.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      ref={ref}
      className="calendar-pop"
      role="dialog"
      aria-label="Pick a date"
      style={width ? { width } : undefined}
      // Nothing typed here should reach the shortcuts and handlers behind it (Del, Enter, a pane's Escape ...)
      onKeyDown={(e) => e.stopPropagation()}
      // Tabbing out of the calendar closes it; a click that lands elsewhere is caught by the pointer listener
      onBlur={(e) => {
        const next = e.relatedTarget;
        if (next instanceof Node && !ref.current?.contains(next)) onClose();
      }}
    >
      <Calendar value={value} today={today} onPick={onPick} />
    </div>
  );
}

// The calendar of the last pickDate, closed by the next one
let floating: { close: () => void } | null = null;

/**
 * Opens the calendar beside `anchor` (a row, say) for a menu entry, which has no button of its own to open it from. `onPick`
 * gets the day, or null when Clear was used.
 */
export function pickDate(
  anchor: Element | null,
  value: string,
  today: string,
  onPick: (date: string | null) => void,
): void {
  floating?.close();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let closed = false;
  const close = () => {
    if (closed) return; // a pick closes it, and so may the focus leaving after
    closed = true;
    if (floating?.close === close) floating = null;
    // After this event: a root is not unmounted from inside its own render
    queueMicrotask(() => {
      root.unmount();
      host.remove();
    });
  };
  floating = { close };
  // The menu that chose this is still closing and handing the focus back (the calendar would otherwise lose it to that)
  setTimeout(() => {
    root.render(
      <CalendarPopover
        anchor={anchor?.getBoundingClientRect() ?? new DOMRect()}
        anchorEl={anchor}
        value={value}
        today={today}
        onPick={(day) => {
          onPick(day);
          close();
        }}
        onClose={close}
      />,
    );
  }, 0);
}

interface DatePickProps {
  /** YYYY-MM-DD, or "" for none */
  value: string;
  today: string;
  /** The picked day, or null when the calendar's Clear was used */
  onChange: (date: string | null) => void;
  label: string;
  className?: string;
  /** The box the calendar lines up with (its left edge and width) instead of the button: the row the button sits in, say */
  alignTo?: RefObject<Element | null>;
  children: ReactNode;
}

/** A button that opens the calendar under itself. */
function DatePick({
  value,
  today,
  onChange,
  label,
  className,
  alignTo,
  children,
}: DatePickProps) {
  const button = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const close = useCallback(() => setAnchor(null), []);

  return (
    <span className="date-pick">
      <Tooltip label={label}>
        <button
          ref={button}
          type="button"
          className={className}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={anchor !== null}
          onClick={() => {
            const box = alignTo?.current ?? button.current;
            setAnchor(anchor ? null : (box?.getBoundingClientRect() ?? null));
          }}
        >
          {children}
        </button>
      </Tooltip>
      {anchor &&
        createPortal(
          <CalendarPopover
            anchor={anchor}
            anchorEl={alignTo?.current ?? button.current}
            trigger={button.current}
            width={anchor.width}
            value={value}
            today={today}
            onPick={(day) => {
              onChange(day);
              close();
            }}
            onClose={close}
          />,
          document.body,
        )}
    </span>
  );
}

export default DatePick;
