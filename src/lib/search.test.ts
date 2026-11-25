// src/lib/search.test.ts
import assert from "node:assert/strict";
import { test, vi } from "vitest";
import {
  fuzzyMatch,
  holdSearchCache,
  parseQuery,
  releaseSearchCache,
  searchItems,
  searchTasks,
} from "./search";
import { makeTask } from "./taskStore";

test("search", () => {
  const item = (
    id: string,
    title: string,
    body: string,
    folderId: string | null = null,
    updatedAt = "2026-01-01T00:00:00.000Z",
  ) => ({
    id,
    title,
    body,
    folderId,
    createdAt: updatedAt,
    updatedAt,
  });

  // ── parseQuery ──
  assert.deepEqual(parseQuery('foo "bar baz" -qux'), [
    { neg: false, key: null, value: "foo" },
    { neg: false, key: null, value: "bar baz" },
    { neg: true, key: null, value: "qux" },
  ]);
  assert.deepEqual(parseQuery('in:"my folder" type:note -type:code title:Hi'), [
    { neg: false, key: "in", value: "my folder" },
    { neg: false, key: "type", value: "note" },
    { neg: true, key: "type", value: "code" },
    { neg: false, key: "title", value: "hi" },
  ]);
  assert.deepEqual(parseQuery("foo:bar -"), [
    { neg: false, key: null, value: "foo:bar" },
    { neg: false, key: null, value: "-" },
  ]);
  assert.deepEqual(parseQuery('"unterminated'), [
    { neg: false, key: null, value: '"unterminated' },
  ]);
  assert.deepEqual(parseQuery("   "), []);

  // ── fuzzyMatch ──
  assert.deepEqual(fuzzyMatch("git clone", "gcl"), [0, 4, 5]);
  assert.equal(fuzzyMatch("node modules setup", "nms"), null); // too spread out
  assert.deepEqual(fuzzyMatch("Readme", "rdm"), [0, 3, 4]);
  assert.equal(fuzzyMatch("abc", "abd"), null);
  // the tight occurrence wins over the leftmost one
  assert.deepEqual(fuzzyMatch("a x x x x x x ab", "ab"), [14, 15]);

  // ── searchItems ──
  const items = [
    item("1", "Groceries", "- [ ] milk\n- [ ] eggs", "Home"),
    item("2", "Git cheatsheet", "```sh\ngit clone <url>\n```", "Dev/Notes"),
    item("3", "Meeting notes", "talked about the milk budget", "Work/Notes"),
    item("4", "Milk run", "plain text", "Home", "2026-06-01T00:00:00.000Z"),
    item("5", "Draft", "draft of something about milk", "Work"),
  ];
  const ids = (q: string) => searchItems(items, q).map((h) => h.item.id);

  // title hit ranks above body hits
  assert.equal(ids("milk")[0], "4");
  assert.deepEqual(new Set(ids("milk")), new Set(["1", "3", "4", "5"]));
  // terms are ANDed
  assert.deepEqual(ids("milk eggs"), ["1"]);
  // phrase
  assert.deepEqual(ids('"milk budget"'), ["3"]);
  assert.deepEqual(ids('"budget milk"'), []);
  // exclusion
  assert.ok(!ids("milk -draft").includes("5"));
  assert.ok(ids("milk -draft").includes("3"));
  // in:
  assert.deepEqual(ids("in:notes").sort(), ["2", "3"]);
  assert.deepEqual(ids("milk in:home").sort(), ["1", "4"]);
  assert.deepEqual(ids('in:"dev/notes"'), ["2"]);
  // type:
  assert.deepEqual(ids("type:note").sort(), ["1", "3", "4", "5"]);
  assert.deepEqual(ids("type:code"), ["2"]);
  assert.deepEqual(ids("milk -type:code").sort(), ["1", "3", "4", "5"]);
  assert.deepEqual(ids("type:todo"), []); // there is no to-do kind any more
  assert.deepEqual(ids("type:nonsense"), []);
  // title:
  assert.deepEqual(ids("title:milk"), ["4"]);
  // fuzzy title
  assert.deepEqual(ids("gitch"), ["2"]);
  assert.deepEqual(ids("gcs"), []); // too spread out in both titles
  assert.deepEqual(ids("grocr"), ["1"]);
  // highlights and snippet
  const hit = searchItems(items, "milk")[0];
  assert.equal(hit.item.id, "4");
  assert.deepEqual(hit.titleMarks, [0, 1, 2, 3]);
  const body = searchItems(items, "budget")[0];
  assert.equal(body.item.id, "3");
  assert.deepEqual(body.snippet, {
    before: "talked about the milk ",
    match: "budget",
    after: "",
  });
  const long = item(
    "9",
    "Long",
    `${"word ".repeat(30)}needle${" tail".repeat(30)}`,
  );
  const sn = searchItems([long], "needle")[0].snippet;
  assert.ok(sn);
  assert.ok(sn.before.startsWith("…") && sn.after.endsWith("…"));
  assert.equal(sn.match, "needle");
  // limit
  assert.equal(searchItems(items, "", 2).length, 2);
  // no terms: everything, newest first
  assert.equal(searchItems(items, "")[0].item.id, "4");
});

test("searchTasks and the operators that tell tasks from notes", () => {
  const at = "2026-06-01T10:00:00.000Z";
  const task = (
    id: string,
    title: string,
    note?: string,
    listName = "Home",
  ) => ({
    listId: `l-${listName}`,
    listName,
    task: makeTask({ id, title, note, now: at }),
  });
  const entries = [
    task("a", "Buy milk"),
    task("b", "Call the plumber", "about the milk leak", "Work"),
    {
      ...task("c", "Plan trip"),
      task: {
        ...task("c", "Plan trip").task,
        steps: [{ id: "s1", title: "book flights", done: false }],
      },
    },
  ];
  const ids = (q: string) =>
    searchTasks(entries, q).map((h) => h.entry.task.id);

  assert.deepEqual(ids("milk"), ["a", "b"]); // the title first, then the note
  assert.deepEqual(ids("flights"), ["c"]); // a step
  assert.deepEqual(ids("milk in:work"), ["b"]); // in: is the list's name
  assert.deepEqual(ids("title:plan"), ["c"]);
  assert.deepEqual(ids("type:task"), ["a", "b", "c"].sort());
  assert.deepEqual(ids("type:note"), []); // a task is not a note
  assert.deepEqual(ids("-type:note milk"), ["a", "b"]);
  assert.deepEqual(ids("-type:task"), []);
  assert.equal(searchTasks(entries, "pl")[0].titleMarks.length > 0, true);
  assert.match(searchTasks(entries, "leak")[0].snippet?.match ?? "", /leak/);

  // the same words find notes, and type:task keeps notes out
  const notes = [
    {
      id: "n",
      title: "Milk run",
      body: "",
      folderId: null,
      createdAt: at,
      updatedAt: at,
    },
  ];
  assert.equal(searchItems(notes, "milk").length, 1);
  assert.equal(searchItems(notes, "type:task").length, 0);
  assert.equal(searchItems(notes, "-type:task").length, 1);
});

test("notes whose text has not been read are found by title and kind, and by text once it is in", () => {
  const note = (
    id: string,
    title: string,
    body: string,
    kind?: "note" | "code",
  ) => ({
    id,
    title,
    folderId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    body,
    ...(kind ? { unloaded: { kind } } : {}),
  });
  const items = [
    note("a", "Budget plan", "", "note"), // text not read
    note("b", "Snippet", "", "code"), // text not read, a code note
    note("c", "Trip", "the budget for the trip"), // loaded
  ];
  // the title is searchable at once; text hits come from the loaded notes only
  assert.deepEqual(
    searchItems(items, "budget").map((h) => h.item.id),
    ["a", "c"],
  );
  assert.deepEqual(
    searchItems(items, "title:budget").map((h) => h.item.id),
    ["a"],
  );
  // type: uses the kind of the scan
  assert.deepEqual(
    searchItems(items, "type:code").map((h) => h.item.id),
    ["b"],
  );
  // once its text arrives (a new object) the note is found by it
  const loaded = [
    ...items.slice(1),
    note("a", "Budget plan", "mentions zebra"),
  ];
  assert.deepEqual(searchItems(items, "zebra"), []);
  assert.deepEqual(
    searchItems(loaded, "zebra").map((h) => h.item.id),
    ["a"],
  );
});

// ── The top of the list is taken in one pass (no sort of everything): same order, ties in list order ───────────────

const note = (id: string, title: string, body: string, updatedAt: string) => ({
  id,
  title,
  body,
  folderId: null,
  createdAt: updatedAt,
  updatedAt,
});

test("an empty query lists the newest first, takes only the limit, and leaves equal dates in list order", () => {
  const t = (day: number) =>
    `2026-03-${String(day).padStart(2, "0")}T10:00:00.000Z`;
  const items = [
    note("a", "A", "", t(5)),
    note("b", "B", "", t(9)),
    note("c", "C", "", t(5)), // the same moment as "a": "a" stays first
    note("d", "D", "", t(1)),
    note("e", "E", "", t(9)), // the same as "b"
    note("f", "F", "", t(7)),
  ];
  const ids = (limit?: number) =>
    searchItems(items, "", limit).map((h) => h.item.id);
  assert.deepEqual(ids(), ["b", "e", "f", "a", "c", "d"]);
  assert.deepEqual(ids(3), ["b", "e", "f"]);
  assert.deepEqual(ids(4), ["b", "e", "f", "a"]); // the cut falls between two equal dates: the earlier in the list wins
  assert.deepEqual(ids(1), ["b"]);
  assert.deepEqual(ids(0), []);
  assert.deepEqual(ids(50), ["b", "e", "f", "a", "c", "d"]);
  // the same notes, the same hits as before: no score, no letters to mark, no snippet
  assert.deepEqual(searchItems(items, "   ", 1), [
    { item: items[1], score: 0, titleMarks: [], snippet: null },
  ]);
  assert.deepEqual(searchItems([], ""), []);
});

test("an empty query reads no text, so notes still being read are listed too", () => {
  const waiting = {
    ...note("w", "Waiting", "", "2026-03-02T00:00:00.000Z"),
    unloaded: { kind: "note" as const },
  };
  const items = [note("a", "A", "text", "2026-03-01T00:00:00.000Z"), waiting];
  assert.deepEqual(
    searchItems(items, "").map((h) => h.item.id),
    ["w", "a"],
  );
});

test("tasks with an empty query: newest first, equal dates in list order", () => {
  const entry = (id: string, at: string) => ({
    listId: "l",
    listName: "Home",
    task: makeTask({ id, title: id, now: at }),
  });
  const entries = [
    entry("a", "2026-03-05T00:00:00.000Z"),
    entry("b", "2026-03-09T00:00:00.000Z"),
    entry("c", "2026-03-05T00:00:00.000Z"),
  ];
  assert.deepEqual(
    searchTasks(entries, "", 2).map((h) => h.entry.task.id),
    ["b", "a"],
  );
});

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("any limit gives the front of the full ranking, which is by score, then newest, then list order (random notes, many equal dates)", () => {
  const rand = mulberry32(7);
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];
  const WORDS = [
    "milk",
    "Milk",
    "budget",
    "plan",
    "trip",
    "zebra",
    "draft",
    "git",
  ];
  const days = [
    "2026-01-01",
    "2026-01-02",
    "2026-02-10",
    "2026-02-10",
    "2026-12-31",
  ];
  const items = Array.from({ length: 300 }, (_, i) =>
    note(
      `n${i}`,
      Array.from({ length: 1 + Math.floor(rand() * 3) }, () =>
        pick(WORDS),
      ).join(" "),
      Array.from({ length: Math.floor(rand() * 12) }, () => pick(WORDS)).join(
        " ",
      ),
      `${pick(days)}T${pick(["08", "09", "09"])}:00:00.000Z`,
    ),
  );
  const at = new Map(items.map((item, i) => [item.id, i]));
  for (const query of [
    "",
    "milk",
    "mil",
    "budget plan",
    "title:trip",
    "-draft",
    "milk -zebra",
    "zzz",
  ]) {
    const full = searchItems(items, query, 1000);
    // the order itself: a higher score first, then a later date, then the earlier in the list
    for (let i = 1; i < full.length; i++) {
      const [p, q] = [full[i - 1], full[i]];
      const order =
        q.score - p.score ||
        q.item.updatedAt.localeCompare(p.item.updatedAt) ||
        (at.get(p.item.id) ?? 0) - (at.get(q.item.id) ?? 0);
      assert.ok(order <= 0, `${query}: ${p.item.id} before ${q.item.id}`);
    }
    // every limit is the front of that list, with the same highlights
    for (const limit of [1, 2, 3, 7, 12, 50, 299, 300]) {
      assert.deepEqual(
        searchItems(items, query, limit),
        full.slice(0, limit),
        `${query} limit ${limit}`,
      );
    }
  }
  // with no terms it is the dates alone: the old way, a stable sort of everything with localeCompare, gives the same list
  const old = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  assert.deepEqual(
    searchItems(items, "", 12).map((h) => h.item.id),
    old.slice(0, 12).map((i) => i.id),
  );
});

test("the lower-cased copies are kept while a search is open and dropped a while after it closes", () => {
  const BODY = "Needle In A Haystack 12345";
  const n = note("c", "Cache", BODY, "2026-03-01T00:00:00.000Z");
  const orig = String.prototype.toLowerCase;
  let lowered = 0;
  String.prototype.toLowerCase = function (this: string) {
    if (String(this) === BODY) lowered++;
    return orig.call(this);
  };
  vi.useFakeTimers();
  try {
    searchItems([n], "needle");
    assert.equal(lowered, 1);
    searchItems([n], "haystack");
    assert.equal(lowered, 1); // the second keystroke reuses the copy
    releaseSearchCache(1000);
    vi.advanceTimersByTime(999);
    searchItems([n], "needle");
    assert.equal(lowered, 1); // not yet
    holdSearchCache(); // a palette opened again: the release is cancelled
    vi.advanceTimersByTime(5000);
    searchItems([n], "needle");
    assert.equal(lowered, 1);
    releaseSearchCache(1000);
    vi.advanceTimersByTime(1000);
    searchItems([n], "needle");
    assert.equal(lowered, 2); // dropped, so made again
  } finally {
    vi.useRealTimers();
    String.prototype.toLowerCase = orig;
    holdSearchCache();
  }
});
