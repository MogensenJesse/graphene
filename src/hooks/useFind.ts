// src/hooks/useFind.ts
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// Find in note (Ctrl+F). The read view paints its matches with the CSS Custom Highlight API, which
// leaves React's DOM alone; the editor selects the current match in its textarea.

const MAX_MATCHES = 2000;

export interface Finder {
  count: number;
  /** The current match, 0-based. */
  index: number;
  next: () => void;
  prev: () => void;
}

/**
 * The open state and search text of a find bar. `signal` goes up each time Ctrl+F is pressed:
 * the bar opens on a change (never just because the view was created with some signal already).
 */
export function useFindState(signal: number) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const seen = useRef(signal);
  useEffect(() => {
    if (signal === seen.current) return;
    seen.current = signal;
    setOpen(true);
  }, [signal]);
  return { open, setOpen, query, setQuery };
}

function useCursor(count: number, query: string) {
  const [index, setIndex] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: start from the first match whenever the search text changes
  useEffect(() => {
    setIndex(0);
  }, [query]);
  const step = useCallback(
    (delta: number) =>
      setIndex((i) =>
        count === 0 ? 0 : (Math.min(i, count - 1) + delta + count) % count,
      ),
    [count],
  );
  return {
    index: count === 0 ? 0 : Math.min(index, count - 1),
    next: () => step(1),
    prev: () => step(-1),
  };
}

/** One Range per occurrence of `query` inside a single text node. ponytail: a match split by formatting ("**bo**ld") is not found. */
function findRanges(root: HTMLElement, query: string): Range[] {
  const q = query.toLowerCase();
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (
    let node = walker.nextNode();
    node && ranges.length < MAX_MATCHES;
    node = walker.nextNode()
  ) {
    const text = (node.nodeValue ?? "").toLowerCase();
    for (
      let at = text.indexOf(q);
      at !== -1 && ranges.length < MAX_MATCHES;
      at = text.indexOf(q, at + q.length)
    ) {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + q.length);
      ranges.push(range);
    }
  }
  return ranges;
}

/** Find `query` in the rendered note under `rootRef` and highlight it; `content` is the note text, to search again when it changes. */
export function useDomFind(
  rootRef: RefObject<HTMLElement | null>,
  query: string,
  content: string,
): Finder {
  const [ranges, setRanges] = useState<Range[]>([]);
  const { index, next, prev } = useCursor(ranges.length, query);

  // biome-ignore lint/correctness/useExhaustiveDependencies: content is the trigger: the rendered text changed
  useEffect(() => {
    const root = rootRef.current;
    setRanges(root && query ? findRanges(root, query) : []);
  }, [rootRef, query, content]);

  useEffect(() => {
    CSS.highlights.set("find", new Highlight(...ranges));
    return () => {
      CSS.highlights.delete("find");
    };
  }, [ranges]);

  useEffect(() => {
    const range = ranges[index];
    if (!range) return;
    CSS.highlights.set("find-current", new Highlight(range));
    range.startContainer.parentElement?.scrollIntoView({ block: "nearest" });
    return () => {
      CSS.highlights.delete("find-current");
    };
  }, [ranges, index]);

  return { count: ranges.length, index, next, prev };
}

/** Scrolls a textarea so the text at `offset` is in view. A hidden copy of the text measures where that is. */
function scrollToOffset(el: HTMLTextAreaElement, offset: number): void {
  const style = getComputedStyle(el);
  const mirror = document.createElement("div");
  for (const p of [
    "fontFamily",
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "tabSize",
  ] as const)
    mirror.style[p] = style[p];
  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    boxSizing: "border-box",
    width: `${el.clientWidth}px`,
    padding: style.padding,
  });
  mirror.textContent = `${el.value.slice(0, offset)}​`;
  document.body.appendChild(mirror);
  const bottom = mirror.scrollHeight; // the bottom of the match's line
  mirror.remove();
  const line = Number.parseFloat(style.lineHeight) || 20;
  if (bottom - line < el.scrollTop || bottom > el.scrollTop + el.clientHeight)
    el.scrollTop = Math.max(0, bottom - el.clientHeight / 2);
}

/** Find `query` in the editor's text and select the current match. `content` is the text, to search again when it changes. */
export function useTextareaFind(
  ref: RefObject<HTMLTextAreaElement | null>,
  query: string,
  content: string,
): Finder {
  const [matches, setMatches] = useState<number[]>([]);
  const { index, next, prev } = useCursor(matches.length, query);

  // biome-ignore lint/correctness/useExhaustiveDependencies: content is the trigger: the text changed
  useEffect(() => {
    const el = ref.current;
    const found: number[] = [];
    if (el && query) {
      const text = el.value.toLowerCase();
      const q = query.toLowerCase();
      for (
        let at = text.indexOf(q);
        at !== -1 && found.length < MAX_MATCHES;
        at = text.indexOf(q, at + q.length)
      )
        found.push(at);
    }
    setMatches(found);
  }, [ref, query, content]);

  useEffect(() => {
    const el = ref.current;
    const at = matches[index];
    // While the user types in the editor itself, their cursor stays where it is
    if (!el || at === undefined || document.activeElement === el) return;
    el.setSelectionRange(at, at + query.length);
    scrollToOffset(el, at);
  }, [ref, matches, index, query]);

  return { count: matches.length, index, next, prev };
}
