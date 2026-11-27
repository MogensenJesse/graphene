// src/components/ui/ContextMenu.tsx
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useBack } from "../../hooks/useBack";
import { IS_TOUCH } from "../../lib/platform";
import {
  placeAtPoint,
  placeBeside,
  visibleBounds,
} from "../../lib/popoverBounds";
import { CheckIcon, ChevronRightIcon } from "./Icon";

interface ActionEntry {
  label: string;
  icon?: ReactNode;
  /** Nesting depth for tree-shaped lists, like the folders under "Move to" */
  indent?: number;
  danger?: boolean;
  disabled?: boolean;
  /** Marks a choice among several (the sort order, the folder a note is in): a check in the icon slot. Set for every
   * choice, true for the current one */
  checked?: boolean;
  /** The shortcut that does the same, shown at the right edge: "Ctrl+K", "F2". Only a shortcut that exists */
  keys?: string;
  onSelect: () => void;
}

interface SubmenuEntry {
  label: string;
  icon?: ReactNode;
  submenu: MenuEntry[];
}

export type MenuEntry = ActionEntry | SubmenuEntry | "separator";

// Focusable rows of one list only (a submenu's rows sit deeper in the DOM)
const ROWS = ':scope > .context-menu__slot > [role^="menuitem"]:not(:disabled)';
const EDGE = 6; // keep this far from the edge of what the page can show
const FINGER_CLEARANCE = 24; // a text menu opened by a finger keeps this far from the point, so the pressed word stays in sight
const SUB_MAX_HEIGHT = 320; // the same cap as `.context-menu--sub`, which the inline max-height replaces

// Counts the resizes of the window on a touch screen, where a resize is mostly the keyboard coming or going (a menu opened from a button
// while a field has the keyboard up is then on screen for a moment before it hides): the menu places itself again instead of closing.
// With a mouse a resize is the window being dragged, and it closes the menu (see ContextMenu).
function useResizeTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!IS_TOUCH) return;
    const next = () => setTick((n) => n + 1);
    window.addEventListener("resize", next);
    return () => window.removeEventListener("resize", next);
  }, []);
  return tick;
}

interface MenuListProps {
  entries: MenuEntry[];
  /** Cursor position of the top-level menu; submenus position themselves off their parent row */
  origin?: { x: number; y: number };
  /** Focus the first row on mount (a submenu opened from the keyboard) */
  focusFirst?: boolean;
  /** Never take focus from the page (the menu of a text field). The pointer drives it. */
  keepFocus?: boolean;
  onDone: () => void;
  /** Close this submenu and hand focus back to its parent row */
  onBack?: () => void;
}

function MenuList({
  entries,
  origin,
  focusFirst,
  keepFocus,
  onDone,
  onBack,
}: MenuListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const resized = useResizeTick();
  const [openSub, setOpenSub] = useState<{
    index: number;
    focus: boolean;
  } | null>(null);

  // Place it inside what the page can show before the first paint (`visibleBounds`: not under the status bar, the navigation bar or the
  // keyboard). The top-level menu goes at the cursor, or beside a finger; a submenu goes beside its row, on whichever side has the room.
  // One taller than the room scrolls.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `resized` only re-runs it, to place the menu again after a resize
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.maxHeight = ""; // measured at its natural height, not the one an earlier run gave it
    const size = { width: el.offsetWidth, height: el.offsetHeight };
    const bounds = visibleBounds(EDGE);
    if (origin) {
      // The menu of a text field on a touch screen stays off the word that was pressed
      const clearance = keepFocus && IS_TOUCH ? FINGER_CLEARANCE : 0;
      const p = placeAtPoint(origin, size, bounds, clearance);
      el.style.left = `${p.left}px`;
      el.style.top = `${p.top}px`;
      el.style.maxHeight = `${p.maxHeight}px`;
      return;
    }
    const slot = el.parentElement;
    if (!slot) return;
    const p = placeBeside(slot.getBoundingClientRect(), size, bounds);
    el.style.left = `${p.left}px`;
    el.style.top = `${p.top}px`;
    el.style.maxHeight = `${Math.min(p.maxHeight, SUB_MAX_HEIGHT)}px`;
  }, [origin, keepFocus, resized]);

  // The top-level menu takes focus itself so the arrow keys work without highlighting a row
  useEffect(() => {
    if (keepFocus || (!origin && !focusFirst)) return;
    const el = ref.current;
    const target = focusFirst ? el?.querySelector<HTMLElement>(ROWS) : el;
    target?.focus({ preventScroll: true });
  }, [origin, focusFirst, keepFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(
      ref.current?.querySelectorAll<HTMLElement>(ROWS) ?? [],
    );
    const at = rows.indexOf(document.activeElement as HTMLElement);
    let next: HTMLElement | undefined;
    let handled = true;

    if (e.key === "ArrowDown") next = rows[(at + 1) % rows.length];
    else if (e.key === "ArrowUp")
      next = rows[at <= 0 ? rows.length - 1 : at - 1];
    else if (e.key === "Home") next = rows[0];
    else if (e.key === "End") next = rows[rows.length - 1];
    else if (e.key === "ArrowLeft" && onBack) onBack();
    else if (e.key === "ArrowRight" && at >= 0) {
      const index = Number(rows[at].dataset.index);
      const entry = entries[index];
      if (typeof entry === "object" && "submenu" in entry)
        setOpenSub({ index, focus: true });
    } else if (e.key !== "Tab") handled = false; // Tab is swallowed so focus stays in the menu

    if (handled) {
      e.preventDefault();
      next?.focus();
    }
    // Nothing typed in a menu should reach the shortcuts behind it (Del, Ctrl+N ...)
    e.stopPropagation();
  };

  return (
    <div
      ref={ref}
      className={`context-menu${origin ? "" : " context-menu--sub"}${keepFocus && origin ? " context-menu--static" : ""}`}
      role="menu"
      tabIndex={-1}
      style={origin && { left: origin.x, top: origin.y }}
      onKeyDown={handleKeyDown}
      // A click on the menu must not blur the text field it belongs to (a blur can commit a rename)
      onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined}
    >
      {entries.map((entry, i) => {
        if (entry === "separator")
          return (
            <hr
              // biome-ignore lint/suspicious/noArrayIndexKey: entries are fixed for the life of an open menu
              key={i}
              className="context-menu__sep"
            />
          );

        const sub = "submenu" in entry;
        const action = sub ? null : entry;
        const subOpen = sub && openSub?.index === i;
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: entries are fixed for the life of an open menu
            key={i}
            className="context-menu__slot"
          >
            {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is menuitemradio whenever checked is set */}
            <button
              type="button"
              role={
                action?.checked === undefined ? "menuitem" : "menuitemradio"
              }
              aria-checked={action?.checked}
              aria-keyshortcuts={action?.keys}
              data-index={i}
              onMouseEnter={(e) => {
                setOpenSub(sub ? { index: i, focus: false } : null);
                // One highlight: hovering moves focus, so the focus style is the hover style
                if (!keepFocus) e.currentTarget.focus({ preventScroll: true });
              }}
              className={`context-menu__item${action?.danger ? " context-menu__item--danger" : ""}`}
              style={
                action?.indent
                  ? { paddingLeft: 8 + action.indent * 14 }
                  : undefined
              }
              disabled={action?.disabled}
              aria-haspopup={sub ? "menu" : undefined}
              aria-expanded={sub ? subOpen : undefined}
              onClick={() => {
                if (action) {
                  action.onSelect();
                  onDone();
                } else {
                  // Focus goes to the submenu's first row for the keys; a finger has none, and the row would stay lit as if hovered
                  setOpenSub({ index: i, focus: !keepFocus && !IS_TOUCH });
                }
              }}
            >
              <span className="context-menu__icon" aria-hidden="true">
                {action?.checked ? <CheckIcon size={14} /> : entry.icon}
              </span>
              <span className="context-menu__label">{entry.label}</span>
              {action?.keys && (
                <span className="context-menu__keys" aria-hidden="true">
                  {action.keys}
                </span>
              )}
              {sub && (
                <span className="context-menu__chevron" aria-hidden="true">
                  <ChevronRightIcon size={12} />
                </span>
              )}
            </button>
            {sub && subOpen && (
              <MenuList
                entries={entry.submenu}
                focusFirst={openSub?.focus}
                keepFocus={keepFocus}
                onDone={onDone}
                onBack={() => {
                  setOpenSub(null);
                  ref.current
                    ?.querySelector<HTMLElement>(`[data-index="${i}"]`)
                    ?.focus();
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface ContextMenuProps {
  x: number;
  y: number;
  entries: MenuEntry[];
  /** The menu of a text field: focus stays in the field, and typing closes the menu */
  keepFocus?: boolean;
  onClose: () => void;
}

const insideMenu = (target: EventTarget | null) =>
  target instanceof Element && target.closest(".context-menu") !== null;

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

// Cursor-positioned menu: closes on a click outside, Escape, losing the window, resize or scroll
function ContextMenu({ x, y, entries, keepFocus, onClose }: ContextMenuProps) {
  // Read during the first render, before the menu takes focus, so closing can hand it back
  const previous = useRef(document.activeElement);
  useBack(onClose);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!insideMenu(e.target)) onClose();
    };
    const onScroll = (e: Event) => {
      if (!insideMenu(e.target)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Capture phase + stop: an open editor's own Escape must not also fire
        e.stopPropagation();
        onClose();
      } else if (keepFocus && !MODIFIER_KEYS.has(e.key)) {
        // The key goes on to the field; the menu's Cut/Copy state would be stale after it
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", onClose);
    // Not on a touch screen: the keyboard resizes the window, and the menu places itself again (`useResizeTick`)
    if (!IS_TOUCH) window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose, keepFocus]);

  // Hand focus back to the tree (or whatever had it) once the menu is gone, unless the choice already put it somewhere (Rename
  // on a task focuses the title in the details pane): then it stays there
  useEffect(() => {
    const el = previous.current;
    return () => {
      const now = document.activeElement;
      const taken = now && now !== document.body && !insideMenu(now);
      if (el instanceof HTMLElement && !taken)
        el.focus({ preventScroll: true });
    };
  }, []);

  // Stable, so MenuList does not re-clamp or re-take focus when the sidebar re-renders
  const origin = useMemo(() => ({ x, y }), [x, y]);

  return (
    <MenuList
      entries={entries}
      origin={origin}
      keepFocus={keepFocus}
      onDone={onClose}
    />
  );
}

export default ContextMenu;
