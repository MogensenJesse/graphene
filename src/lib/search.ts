// src/lib/search.ts
import type { Item } from "../types";
import type { Task } from "./taskStore";
import { itemKind } from "./utils";

// ── Query language ────────────────────────────────────────────────────────────
// Words and "quoted phrases" must all be found in a note's (or task's) title or text. Operators narrow it down:
//   in:folder     the note's folder path, or the task's list name, contains it (in:"my folder" for spaces)
//   type:code     note, code or task
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

const KIND_ALIAS: Record<string, string> = {
  note: "note",
  notes: "note",
  code: "code",
  task: "task",
  tasks: "task",
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

/** What a search looks at in a note or a task, lower-cased: its title, its text, where it is kept, and what it is. */
interface Doc {
  title: string;
  body: string;
  /** A note's folder path, a task's list name */
  place: string;
  /** "note", "code" or "task" */
  kind: string;
}

/** Whether a note or task passes one operator term (a "-" term passes when it does NOT match it). */
function passes(term: Term, doc: Doc): boolean {
  let found: boolean;
  if (term.key === "in") {
    found = doc.place.includes(term.value);
  } else if (term.key === "type") {
    found = doc.kind === KIND_ALIAS[term.value];
  } else if (term.key === "title") {
    found = doc.title.includes(term.value);
  } else {
    found = doc.title.includes(term.value) || doc.body.includes(term.value);
  }
  return found !== term.neg;
}

// Lower-case title and text per note or task, so a keystroke does not lower-case every one again. Keyed by the
// object: an edit makes a new one, and a rescan keeps the old object for those that did not change.
const lowerCache = new WeakMap<object, { title: string; body: string }>();

function lowered(
  key: object,
  title: string,
  body: () => string,
): { title: string; body: string } {
  let l = lowerCache.get(key);
  if (!l) {
    l = { title: title.toLowerCase(), body: body().toLowerCase() };
    lowerCache.set(key, l);
  }
  return l;
}

/** Everything that fits the query, best first (title matches, then text matches, newest within a score). */
function rank<T>(
  entries: T[],
  terms: Term[],
  docOf: (entry: T) => Doc,
  updatedOf: (entry: T) => string,
): { entry: T; score: number; doc: Doc }[] {
  const scored: { entry: T; score: number; doc: Doc }[] = [];
  for (const entry of entries) {
    const doc = docOf(entry);
    let score = 0;
    let ok = true;
    for (const term of terms) {
      if (term.key === null && !term.neg) {
        const s = termScore(term, doc.title, doc.body);
        if (s === 0) {
          ok = false;
          break;
        }
        score += s;
      } else if (!passes(term, doc)) {
        ok = false;
        break;
      }
    }
    if (ok) scored.push({ entry, score, doc });
  }
  return scored.sort(
    (a, b) =>
      b.score - a.score || updatedOf(b.entry).localeCompare(updatedOf(a.entry)),
  );
}

/** The title letters to highlight and the part of the text that matched, for one kept result. */
function highlights(
  terms: Term[],
  doc: Doc,
  rawBody: string,
): { titleMarks: number[]; snippet: Snippet | null } {
  const words = terms.filter((t) => t.key === null && !t.neg);
  const marks = new Set<number>();
  for (const { value } of words) {
    const at = doc.title.indexOf(value);
    if (at !== -1) {
      for (let i = 0; i < value.length; i++) marks.add(at + i);
    } else if (!value.includes(" ") && value.length >= 2) {
      for (const i of fuzzyMatch(doc.title, value) ?? []) marks.add(i);
    }
  }
  let snippet: Snippet | null = null;
  for (const { value } of words) {
    const at = doc.body.indexOf(value);
    if (at !== -1) {
      snippet = snippetAt(rawBody, at, value.length);
      break;
    }
  }
  return { titleMarks: [...marks].sort((a, b) => a - b), snippet };
}

const itemDoc = (item: Item): Doc => ({
  ...lowered(item, item.title, () => item.body),
  place: (item.folderId ?? "").toLowerCase(),
  kind: itemKind(item),
});

/**
 * Notes that fit the query, best first (title matches, then text matches, newest within a score).
 * Only the `limit` kept notes get their highlights and snippet worked out.
 */
export function searchItems(items: Item[], query: string, limit = 50): Hit[] {
  const terms = parseQuery(query);
  return rank(items, terms, itemDoc, (i) => i.updatedAt)
    .slice(0, limit)
    .map(({ entry: item, score, doc }) => ({
      item,
      score,
      ...highlights(terms, doc, item.body),
    }));
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

/** A task with the list it is in (a task does not know its list's name). */
export interface TaskEntry {
  listId: string;
  listName: string;
  task: Task;
}

export interface TaskHit {
  entry: TaskEntry;
  score: number;
  titleMarks: number[];
  snippet: Snippet | null;
}

// What a task's "text" is: its note, then its steps
const taskText = (task: Task) =>
  [task.note ?? "", ...task.steps.map((s) => s.title)].join("\n");

/** Tasks that fit the query, as notes do: the title, the note and the steps are searched; `in:` is the list's name. */
export function searchTasks(
  entries: TaskEntry[],
  query: string,
  limit = 50,
): TaskHit[] {
  const terms = parseQuery(query);
  const docOf = ({ task, listName }: TaskEntry): Doc => ({
    ...lowered(task, task.title, () => taskText(task)),
    place: listName.toLowerCase(),
    kind: "task",
  });
  return rank(entries, terms, docOf, (e) => e.task.updatedAt)
    .slice(0, limit)
    .map(({ entry, score, doc }) => ({
      entry,
      score,
      ...highlights(terms, doc, taskText(entry.task)),
    }));
}
