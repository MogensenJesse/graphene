// src/components/ui/Select.tsx
import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useAnchorRect } from "../../hooks/useAnchorRect";
import { useEscape } from "../../hooks/useEscape";
import { filterOptions } from "../../lib/optionFilter";
import { placeBelow, visibleBounds } from "../../lib/popoverBounds";
import { ChevronDownIcon } from "./Icon";

const EDGE = 8; // keep this far from the edge of what the page can show
const GAP = 4; // between the button and the list
const PAGE = 8; // rows Page Up and Page Down jump
const MIN_ROOM = 200; // under the button, before the list opens above it instead

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** How the row is drawn: the font list shows each font in itself */
  style?: CSSProperties;
}

interface SelectProps<T extends string> {
  /** Accessible name of the list */
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** A box above the list that narrows it, for a long one */
  searchable?: boolean;
  /** What the button says while no option has the value */
  placeholder?: string;
  /** What the list says when there is nothing to show (a list still loading, a search with no match) */
  emptyText?: string;
  /** A name typed in the box that no option has is offered as a row of its own, `Use "name"`, and picked as the value */
  allowTyped?: boolean;
  className?: string;
}

interface PopoverProps<T extends string> {
  /** Where the list opens: under this box, or above it when the window has no room below */
  anchor: DOMRect;
  /** The button that opened it: a press on it is its own toggle, not a click outside */
  trigger: HTMLElement | null;
  label: string;
  value: T;
  options: SelectOption<T>[];
  searchable: boolean;
  emptyText: string;
  allowTyped: boolean;
  onPick: (value: T) => void;
  /** `refocus`: hand the focus back to the button (Escape, a pick); a click elsewhere has put it where it wants */
  onClose: (refocus: boolean) => void;
}

const insidePopover = (target: EventTarget | null) =>
  target instanceof Element && target.closest(".select-pop") !== null;

/**
 * The list in a box over the page. It closes on a pick, Escape, Tab, a click elsewhere, losing the window or a scroll. A resize (a phone's
 * keyboard going up or down) places it again.
 */
function SelectPopover<T extends string>({
  anchor,
  trigger,
  label,
  value,
  options,
  searchable,
  emptyText,
  allowTyped,
  onPick,
  onClose,
}: PopoverProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rect = useAnchorRect(anchor, trigger, () => onClose(false));
  const listId = useId();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  );

  const typed = allowTyped ? query.trim() : "";
  const shown = useMemo(() => {
    const found = filterOptions(options, query);
    // Anything not in the list is still a valid value, reachable as the last row
    return typed &&
      !found.some((o) => o.label.toLowerCase() === typed.toLowerCase())
      ? [...found, { value: typed as T, label: `Use "${typed}"` }]
      : found;
  }, [options, query, typed]);

  // Under the button, cut to the room there, or above it when that is too little and there is more room above; inside what the page
  // can show (not under a system bar or the keyboard) before the first paint. Above, it hangs from the button's top edge, so a
  // shorter list (a search) stays next to the button. Again when the window is resized (a phone's keyboard)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.maxHeight = ""; // measured at its natural height, not the one an earlier run gave it
    const p = placeBelow(
      rect,
      { width: el.offsetWidth, height: el.scrollHeight },
      visibleBounds(EDGE),
      GAP,
      MIN_ROOM,
    );
    el.style.maxHeight = `${Math.max(120, p.maxHeight)}px`;
    el.style.left = `${p.left}px`;
    if (p.up) {
      el.style.top = "auto";
      el.style.bottom = `${window.innerHeight - p.bottom}px`;
    } else {
      el.style.top = `${p.top}px`;
      el.style.bottom = "auto";
    }
  }, [rect]);

  // The box that takes the keys: the search field, or the list itself. A touch screen has no keys to send it: the search field
  // would only raise the keyboard over the list, so it is left for a tap
  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    (searchable && !touch ? inputRef.current : listRef.current)?.focus();
  }, [searchable]);

  // Also when the list is made again: an unchanged index still needs its row brought into view
  // biome-ignore lint/correctness/useExhaustiveDependencies: `shown` only re-runs it when the rows are drawn again
  useEffect(() => {
    listRef.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }, [index, shown]);

  useEscape(() => onClose(true), { capture: true });

  useEffect(() => {
    const close = () => onClose(false);
    const onPointerDown = (e: PointerEvent) => {
      if (!insidePopover(e.target) && !trigger?.contains(e.target as Node))
        close();
    };
    const onScroll = (e: Event) => {
      if (!insidePopover(e.target)) close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("blur", close);
    };
  }, [trigger, onClose]);

  const move = (to: number) =>
    setIndex(Math.max(0, Math.min(shown.length - 1, to)));

  const onKeyDown = (e: KeyboardEvent) => {
    // Nothing typed here should reach the shortcuts and handlers behind it
    e.stopPropagation();
    if (e.key === "ArrowDown") move(index + 1);
    else if (e.key === "ArrowUp") move(index - 1);
    else if (e.key === "PageDown") move(index + PAGE);
    else if (e.key === "PageUp") move(index - PAGE);
    // In the search field Home and End move the caret
    else if ((e.key === "Home" || e.key === "End") && !searchable)
      move(e.key === "Home" ? 0 : shown.length - 1);
    else if (e.key === "Enter") {
      const choice = shown[index];
      if (choice) onPick(choice.value);
    } else {
      // Tab goes on to the next control from the button; every other key is for the search field
      if (e.key === "Tab") onClose(true);
      return;
    }
    e.preventDefault();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only a frame; the keys come from the search field or the list inside it, which are the controls and have the roles
    <div
      ref={ref}
      className="select-pop"
      // The dialog under it keeps Escape for itself, unless the focus is in something that owns it
      data-owns-escape
      onKeyDown={onKeyDown}
      // Tabbing away is caught above; a click that lands elsewhere is caught by the pointer listener
      onBlur={(e) => {
        const next = e.relatedTarget;
        if (
          next instanceof Node &&
          !ref.current?.contains(next) &&
          !trigger?.contains(next)
        )
          onClose(false);
      }}
      style={{ width: anchor.width }}
    >
      {searchable && (
        <input
          ref={inputRef}
          type="text"
          className="select-pop__input"
          placeholder="Search…"
          aria-label={`Search ${label}`}
          aria-controls={listId}
          aria-activedescendant={
            shown[index] ? `${listId}-${index}` : undefined
          }
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
        />
      )}
      <div
        ref={listRef}
        id={listId}
        className="select-pop__list"
        role="listbox"
        aria-label={label}
        tabIndex={-1}
        aria-activedescendant={
          !searchable && shown[index] ? `${listId}-${index}` : undefined
        }
      >
        {shown.map((o, i) => (
          <button
            key={`${o.value}\n${o.label}`}
            id={`${listId}-${i}`}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={o.value === value}
            className={`select-pop__option${i === index ? " select-pop__option--active" : ""}${o.value === value ? " select-pop__option--current" : ""}`}
            style={o.style}
            onMouseMove={() => setIndex(i)}
            onClick={() => onPick(o.value)}
          >
            {o.label}
          </button>
        ))}
        {shown.length === 0 && <p className="select-pop__empty">{emptyText}</p>}
      </div>
    </div>
  );
}

/**
 * A button that shows the chosen option and opens a list of the others under itself: for a choice with many options, or
 * whose options are long. A few short ones are a `Segmented`. The list is in a box over the page, so a dialog's own
 * scrolling and clipping cannot cut it off; `searchable` adds a box that narrows it.
 */
function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  searchable = false,
  placeholder = "Choose…",
  emptyText = "Nothing found",
  allowTyped = false,
  className,
}: SelectProps<T>) {
  const button = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const current = options.find((o) => o.value === value);
  const text = current?.label ?? (value || placeholder);

  const close = useCallback((refocus: boolean) => {
    setAnchor(null);
    if (refocus) button.current?.focus({ preventScroll: true });
  }, []);
  const open = () => setAnchor(button.current?.getBoundingClientRect() ?? null);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`select${anchor ? " select--open" : ""}${className ? ` ${className}` : ""}`}
        aria-label={`${label}: ${text}`}
        aria-haspopup="listbox"
        aria-expanded={anchor !== null}
        onClick={() => (anchor ? close(false) : open())}
        onKeyDown={(e) => {
          if (anchor || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
          e.preventDefault();
          open();
        }}
      >
        <span
          className={`select__value${current || value ? "" : " select__value--placeholder"}`}
          style={current?.style}
        >
          {text}
        </span>
        <span className="select__chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {anchor &&
        createPortal(
          <SelectPopover
            anchor={anchor}
            trigger={button.current}
            label={label}
            value={value}
            options={options}
            searchable={searchable}
            emptyText={emptyText}
            allowTyped={allowTyped}
            onPick={(next) => {
              onChange(next);
              close(true);
            }}
            onClose={close}
          />,
          document.body,
        )}
    </>
  );
}

export default Select;
