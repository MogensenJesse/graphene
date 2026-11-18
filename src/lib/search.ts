// src/lib/search.ts
import type { Item, ItemKind, TypeFilter } from "../types";
import { itemKind } from "./utils";

/** The items of one type; "all" keeps everything. Returns a fresh array. */
export function filterByType(items: Item[], typeFilter: TypeFilter): Item[] {
  return typeFilter === "all"
    ? [...items]
    : items.filter((item) => itemKind(item) === typeFilter);
}

// ── Query language ────────────────────────────────────────────────────────────
// Words and "quoted phrases" must all be found in a note's title or text. Operators narrow it down:
//   in:folder     the note's folder path contains it (in:"my folder" for spaces)
//   type:todo     note, code or todo
//   title:word    the title contains it
// A leading "-" turns any of them into an exclusion (-draft, -type:code).

type Key = "in" | "type" | "title" | null;

interface Term {
  neg: boolean;
  key: Key;
  value: string; // lower case
}

export function parseQuery(query: string): Term[] {
  const terms: Term[] = [];
  for (const m of query.matchAll(
    /(-?)(?:(in|type|title):)?(?:"([^"]*)"|(\S+))/g,
  )) {
    const value = (m[3] ?? m[4]).trim().toLowerCase();
    if (value)
      terms.push({ neg: m[1] === "-", key: (m[2] as Key) ?? null, value });
  }
  return terms;
}

const KIND_ALIAS: Record<string, ItemKind> = {
  note: "note",
  notes: "note",
  code: "code",
  todo: "todo",
  todos: "todo",
  "to-do": "todo",
  "to-dos": "todo",
};

/**
 * The positions of `term` in `text` as scattered letters in order ("gcl" in "git clone"), as tight a
 * span as possible, or null. ponytail: positions are taken from the lower-cased text, so a letter
 * that changes length when lower-cased (rare) would shift the highlight.
 */
export function fuzzyMatch(text: string, term: string): number[] | null {
  const t = text.toLowerCase();
  let best: number[] | null = null;
  for (let s = t.indexOf(term[0]); s !== -1; s = t.indexOf(term[0], s + 1)) {
    const at = [s];
    for (let k = 1; k < term.length; k++) {
      const j = t.indexOf(term[k], at[k - 1] + 1);
      if (j === -1) break;
      at.push(j);
    }
    if (at.length < term.length) break; // later starts only have less text left
    if (!best || at[at.length - 1] - at[0] < best[best.length - 1] - best[0])
      best = at;
  }
  // Letters far apart are noise, not a match: at most a few stray letters in between
  return best && best[best.length - 1] - best[0] <= term.length + 3
    ? best
    : null;
}

interface Snippet {
  before: string;
  match: string;
  after: string;
}

export interface Hit {
  item: Item;
  score: number;
  /** Positions of the title's letters to highlight. */
  titleMarks: number[];
  /** Where the text matched, with its surroundings. */
  snippet: Snippet | null;
}

const SNIPPET_CONTEXT = 40;

function snippetAt(body: string, at: number, length: number): Snippet {
  const from = Math.max(0, at - SNIPPET_CONTEXT);
  const to = Math.min(body.length, at + length + SNIPPET_CONTEXT);
  const flat = (s: string) => s.replace(/\s+/g, " ");
  return {
    before: (from > 0 ? "…" : "") + flat(body.slice(from, at)),
    match: flat(body.slice(at, at + length)),
    after: flat(body.slice(at + length, to)) + (to < body.length ? "…" : ""),
  };
}

/** How well one plain term fits a note: 0 = not at all, else title start 4, in title 3, scattered in title 2, in text 1. */
function termScore(term: Term, title: string, body: string): number {
  const at = title.indexOf(term.value);
  if (at === 0) return 4;
  if (at > 0) return 3;
  if (
    !term.value.includes(" ") &&
    term.value.length >= 2 &&
    fuzzyMatch(title, term.value)
  )
    return 2;
  return body.includes(term.value) ? 1 : 0;
}

/** Whether a note passes one operator term (a "-" term passes when the note does NOT match it). */
function passes(term: Term, item: Item, title: string, body: string): boolean {
  let found: boolean;
  if (term.key === "in") {
    found = (item.folderId ?? "").toLowerCase().includes(term.value);
  } else if (term.key === "type") {
    found = itemKind(item) === KIND_ALIAS[term.value];
  } else if (term.key === "title") {
    found = title.includes(term.value);
  } else {
    found = title.includes(term.value) || body.includes(term.value);
  }
  return found !== term.neg;
}

// Lower-case title and text per note, so a keystroke does not lower-case every note again. Keyed by the
// item object: an edit makes a new one, and a rescan keeps the old object for notes that did not change.
const lowerCache = new WeakMap<Item, { title: string; body: string }>();

function lowered(item: Item): { title: string; body: string } {
  let l = lowerCache.get(item);
  if (!l) {
    l = { title: item.title.toLowerCase(), body: item.body.toLowerCase() };
    lowerCache.set(item, l);
  }
  return l;
}

/**
 * Notes that fit the query, best first (title matches, then text matches, newest within a score).
 * Only the `limit` kept notes get their highlights and snippet worked out.
 */
export function searchItems(items: Item[], query: string, limit = 50): Hit[] {
  const terms = parseQuery(query);
  const scored: { item: Item; score: number }[] = [];

  for (const item of items) {
    const { title, body } = lowered(item);
    let score = 0;
    let ok = true;
    for (const term of terms) {
      if (term.key === null && !term.neg) {
        const s = termScore(term, title, body);
        if (s === 0) {
          ok = false;
          break;
        }
        score += s;
      } else if (!passes(term, item, title, body)) {
        ok = false;
        break;
      }
    }
    if (ok) scored.push({ item, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt),
  );

  const words = terms.filter((t) => t.key === null && !t.neg);
  return scored.slice(0, limit).map(({ item, score }) => {
    const { title, body } = lowered(item);
    const marks = new Set<number>();
    for (const { value } of words) {
      const at = title.indexOf(value);
      if (at !== -1) {
        for (let i = 0; i < value.length; i++) marks.add(at + i);
      } else if (!value.includes(" ") && value.length >= 2) {
        for (const i of fuzzyMatch(title, value) ?? []) marks.add(i);
      }
    }
    let snippet: Snippet | null = null;
    for (const { value } of words) {
      const at = body.indexOf(value);
      if (at !== -1) {
        snippet = snippetAt(item.body, at, value.length);
        break;
      }
    }
    return {
      item,
      score,
      titleMarks: [...marks].sort((a, b) => a - b),
      snippet,
    };
  });
}
