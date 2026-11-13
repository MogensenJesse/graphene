// src/components/ContextMenu.tsx
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckIcon, ChevronRightIcon } from "./Icon";

interface ActionEntry {
  label: string;
  icon?: ReactNode;
  /** Nesting depth for tree-shaped lists, like the folders under "Move to" */
  indent?: number;
  danger?: boolean;
  disabled?: boolean;
  /** Shows a check in the icon slot */
  checked?: boolean;
  onSelect: () => void;
}

interface SubmenuEntry {
  label: string;
  icon?: ReactNode;
  submenu: MenuEntry[];
}

export type MenuEntry = ActionEntry | SubmenuEntry | "separator";

// Focusable rows of one list only (a submenu's rows sit deeper in the DOM)
const ROWS = ':scope > .context-menu__slot > [role="menuitem"]:not(:disabled)';
const EDGE = 6; // keep this far from the window edge

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
  const [openSub, setOpenSub] = useState<{
    index: number;
    focus: boolean;
  } | null>(null);

  // Clamp into the window before the first paint. The top-level menu is placed at the cursor;
  // a submenu opens to the right of its row and flips left / shifts up near the edges.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (origin) {
      el.style.left = `${Math.max(EDGE, Math.min(origin.x, window.innerWidth - r.width - EDGE))}px`;
      el.style.top = `${Math.max(EDGE, Math.min(origin.y, window.innerHeight - r.height - EDGE))}px`;
      return;
    }
    if (r.right > window.innerWidth - EDGE) {
      el.style.left = "auto";
      el.style.right = "calc(100% - 4px)";
    }
    if (r.bottom > window.innerHeight - EDGE) {
      el.style.top = `${-5 - (r.bottom - window.innerHeight + EDGE)}px`;
    }
  }, [origin]);

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
            <button
              type="button"
              role="menuitem"
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
                  setOpenSub({ index: i, focus: !keepFocus });
                }
              }}
            >
              <span className="context-menu__icon" aria-hidden="true">
                {action?.checked ? <CheckIcon size={14} /> : entry.icon}
              </span>
              <span className="context-menu__label">{entry.label}</span>
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
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose, keepFocus]);

  // Hand focus back to the tree (or whatever had it) once the menu is gone
  useEffect(() => {
    const el = previous.current;
    return () => {
      if (el instanceof HTMLElement) el.focus({ preventScroll: true });
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
