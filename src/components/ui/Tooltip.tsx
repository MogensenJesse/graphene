// src/components/ui/Tooltip.tsx
import {
  cloneElement,
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { IS_TOUCH } from "../../lib/platform";

const SHOW_DELAY_MS = 350;
const GAP = 8; // between the button and the tip
const EDGE = 8; // keep this far from the window edge

interface TooltipProps {
  label: string;
  /** Shortcut, e.g. "Ctrl+B" */
  keys?: string;
  /** What the button writes, e.g. "**bold**" */
  hint?: string;
  /** One button; the tooltip hooks into its hover and focus */
  children: ReactElement<React.HTMLAttributes<HTMLElement>>;
}

function Bubble({
  anchor,
  label,
  keys,
  hint,
}: Omit<TooltipProps, "children"> & { anchor: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null);

  // Centred under the button (above it when the window has no room below), then pulled back
  // inside the window before the first paint
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const x = anchor.left + anchor.width / 2 - el.offsetWidth / 2;
    el.style.left = `${Math.max(EDGE, Math.min(x, window.innerWidth - el.offsetWidth - EDGE))}px`;
    if (anchor.bottom + GAP + el.offsetHeight > window.innerHeight - EDGE)
      el.style.top = `${Math.max(EDGE, anchor.top - GAP - el.offsetHeight)}px`;
  }, [anchor]);

  return (
    <div
      ref={ref}
      className="tooltip"
      role="tooltip"
      style={{ top: anchor.bottom + GAP }}
    >
      <div className="tooltip__head">
        <span className="tooltip__label">{label}</span>
        {keys && (
          <span className="tooltip__keys">
            {keys.split("+").map((key) => (
              <kbd key={key} className="tooltip__key">
                {key}
              </kbd>
            ))}
          </span>
        )}
      </div>
      {hint && <code className="tooltip__hint">{hint}</code>}
    </div>
  );
}

/**
 * Styled tooltip for a button that has no visible name of its own, or a shortcut worth showing: name,
 * shortcut and, for the formatting buttons, the markdown it writes. Shows after a short hover or at once
 * on keyboard focus (not on the focus a mouse click gives), and goes away on a click. The tip is
 * portalled to the body, so no overflow in the editor clips it.
 */
function HoverTooltip({ label, keys, hint, children }: TooltipProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setAnchor(null);
  }, []);
  const show = (el: HTMLElement, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setAnchor(el.getBoundingClientRect()),
      delay,
    );
  };

  // Clicking, typing or scrolling dismisses it, and so does anything that moves the button out from
  // under a tip that stays put: the window resizing (maximise) or losing focus (minimise, alt-tab)
  useEffect(() => {
    if (!anchor) return;
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", hide, true);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("keydown", hide, true);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("blur", hide);
    };
  }, [anchor, hide]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      {cloneElement(children, {
        onMouseEnter: (e) => {
          children.props.onMouseEnter?.(e);
          show(e.currentTarget, SHOW_DELAY_MS);
        },
        onMouseLeave: (e) => {
          children.props.onMouseLeave?.(e);
          hide();
        },
        // A click cancels a tip still waiting for its delay. The document listener above only
        // exists once the tip is up
        onPointerDown: (e) => {
          children.props.onPointerDown?.(e);
          hide();
        },
        // Only keyboard focus shows it. A click focuses the button too, which would bring the tip
        // straight back after the click and leave it there
        onFocus: (e) => {
          children.props.onFocus?.(e);
          if (e.currentTarget.matches(":focus-visible"))
            show(e.currentTarget, 0);
        },
        onBlur: (e) => {
          children.props.onBlur?.(e);
          hide();
        },
        // The shortcut the tooltip shows, for screen readers too
        "aria-keyshortcuts": keys ?? children.props["aria-keyshortcuts"],
      })}
      {anchor &&
        createPortal(
          <Bubble anchor={anchor} label={label} keys={keys} hint={hint} />,
          document.body,
        )}
    </>
  );
}

// A touch screen has nothing to hover with: the button as it is, with no timer, listeners or portal for a tip that would never show
function Tooltip(props: TooltipProps) {
  return IS_TOUCH ? props.children : <HoverTooltip {...props} />;
}

export default Tooltip;
