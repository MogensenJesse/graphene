// src/lib/search.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { fuzzyMatch, parseQuery, searchItems, searchTasks } from "./search";
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
