// mcp/tools.test.ts
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { test } from "vitest";
import { serializeItem } from "../src/lib/fileFormat";
import { itemFilePath } from "../src/lib/itemPaths";
import { joinPath } from "../src/lib/paths";
import type { Item } from "../src/types";
import { createServer } from "./server";
import {
  appendToNote,
  createNote,
  editNote,
  folderPath,
  listFolders,
  readNote,
  searchNotes,
} from "./tools";

const at = "2026-01-02T00:00:00.000Z";
const note = (
  id: string,
  title: string,
  folderId: string | null,
  body: string,
  order?: number,
): Item => ({
  id,
  title,
  folderId,
  body,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: at,
  ...(order === undefined ? {} : { order }),
});

/** A vault on disk with a few notes, written the way the app names its files; removed afterwards. */
async function withVault(run: (vault: string) => Promise<void>) {
  const vault = joinPath(mkdtempSync(joinPath(tmpdir(), "graphene-mcp-")));
  const notes = [
    note("p1", "Agent prompts", "Prompts", "Always plan first.\n", 2048),
    note(
      "t1",
      "To do Graphene",
      "To do lists",
      "- [ ] ship mcp due:2026-12-01\n- [x] audit ui\n```\n- [ ] fenced\n```\n- [ ] write docs due:2026-11-20\n",
    ),
    note("t2", "Groceries", null, "- [ ] milk\n"),
  ];
  for (const n of notes) {
    const path = itemFilePath(vault, n);
    mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    writeFileSync(path, serializeItem(n));
  }
  writeFileSync(
    joinPath(vault, ".trash-note.md"),
    "---\nid: gone\n---\nignored",
  ); // dot files are not content
  mkdirSync(joinPath(vault, "attachments"));
  writeFileSync(
    joinPath(vault, "attachments", "x.md"),
    serializeItem(note("img", "Not a note", null, "")),
  );
  try {
    await run(vault);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
}

test("reading: folders, search, a note", () =>
  withVault(async (vault) => {
    assert.deepEqual(await listFolders(vault), {
      notesWithoutFolder: 1,
      folders: [
        { path: "Prompts", notes: 1 },
        { path: "To do lists", notes: 1 },
      ],
    });

    const found = await searchNotes(vault, { query: "plan in:prompts" });
    assert.equal(found.length, 1);
    assert.match(found[0].snippet ?? "", /plan first/);
    assert.equal((await searchNotes(vault, {})).length, 3); // empty query: everything, newest first

    const read = await readNote(vault, { id: "p1" });
    assert.equal(read.kind, "note");
    assert.equal(read.folder, "Prompts");
    assert.equal(read.body, "Always plan first.\n");
    await assert.rejects(readNote(vault, { id: "nope" }), /No note with id/);
  }));

test("writing: create and append keep the note the way the app wrote it", () =>
  withVault(async (vault) => {
    const created = await createNote(vault, {
      title: "Saved from agent\nsecond line",
      body: "hello",
      folder: "Inbox\\Agents",
    });
    assert.equal(created.title, "Saved from agent second line");
    assert.equal(created.folder, "Inbox/Agents");
    // the file name is the one the app would give it, in a folder that did not exist
    const expected = itemFilePath(
      vault,
      note(created.id, created.title, "Inbox/Agents", ""),
    );
    assert.ok(
      readdirSync(joinPath(vault, "Inbox/Agents")).includes(
        expected.slice(expected.lastIndexOf("/") + 1),
      ),
    );
    assert.equal((await readNote(vault, { id: created.id })).body, "hello");

    await appendToNote(vault, { id: "p1", text: "Then verify." });
    const p1 = readFileSync(
      itemFilePath(vault, note("p1", "Agent prompts", "Prompts", "")),
      "utf8",
    );
    assert.match(
      p1,
      /^---\nid: p1\ntitle: Agent prompts\nfolderId: Prompts\ncreatedAt: 2026-01-01T00:00:00.000Z\nupdatedAt: (?!2026-01-02T)\S+\norder: 2048\n---\nAlways plan first.\nThen verify.$/,
    );
  }));

test("editing replaces text and keeps the rest of the note as the app wrote it", () =>
  withVault(async (vault) => {
    const r = await editNote(vault, {
      id: "p1",
      old_text: "plan first.\r\n", // a model may copy line ends as CRLF
      new_text: "verify $& twice.\n", // "$&" must not be read as a pattern
    });
    assert.equal(r.replaced, 1);
    const p1 = readFileSync(
      itemFilePath(vault, note("p1", "Agent prompts", "Prompts", "")),
      "utf8",
    );
    assert.match(
      p1,
      /^---\nid: p1\ntitle: Agent prompts\nfolderId: Prompts\ncreatedAt: 2026-01-01T00:00:00.000Z\nupdatedAt: (?!2026-01-02T)\S+\norder: 2048\n---\nAlways verify \$& twice\.\n$/,
    );

    // several matches need replace_all; none, or an empty old_text, is an error and leaves the note alone
    const due = { id: "t1", old_text: "due:2026", new_text: "due:2027" };
    await assert.rejects(editNote(vault, due), /appears 2 times/);
    assert.equal(
      (await editNote(vault, { ...due, replace_all: true })).replaced,
      2,
    );
    assert.match(
      (await readNote(vault, { id: "t1" })).body,
      /due:2027-12-01.*due:2027-11-20/s,
    );
    await assert.rejects(
      editNote(vault, { ...due, old_text: "nope" }),
      /not found/,
    );
    await assert.rejects(
      editNote(vault, { ...due, old_text: "" }),
      /must not be empty/,
    );

    // deleting text, and a replacement that changes nothing does not touch the file
    await editNote(vault, { id: "t2", old_text: "- [ ] ", new_text: "" });
    assert.equal((await readNote(vault, { id: "t2" })).body, "milk\n");
    const before = (await readNote(vault, { id: "t2" })).updated;
    await editNote(vault, { id: "t2", old_text: "milk", new_text: "milk" });
    assert.equal((await readNote(vault, { id: "t2" })).updated, before);
  }));

test("a folder path from a model is checked", () => {
  assert.equal(folderPath(undefined), null);
  assert.equal(folderPath("Prompts//Agents"), "Prompts/Agents");
  for (const bad of [
    "../x",
    "a/../b",
    "/abs",
    "C:/x",
    "attachments",
    ".hidden",
    "a/ /b",
    "a/b?",
  ])
    assert.throws(() => folderPath(bad), /not a usable folder path/, bad);
});

test("the server lists its tools and answers a call", () =>
  withVault(async (vault) => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await createServer(vault).connect(serverSide);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(clientSide);
    assert.deepEqual(
      (await client.listTools()).tools.map((t) => t.name),
      [
        "list_vaults",
        "list_folders",
        "search_notes",
        "read_note",
        "create_note",
        "append_to_note",
        "edit_note",
        "list_task_lists",
        "list_tasks",
        "add_task",
        "update_task",
        "complete_task",
        "create_task_list",
      ],
    );
    const result = await client.callTool({
      name: "search_notes",
      arguments: { query: "milk" },
    });
    const [first] = result.content as { type: string; text: string }[];
    assert.equal(JSON.parse(first.text).notes[0].id, "t2");
    assert.equal(JSON.parse(first.text).vault, vault.split("/").pop());

    // through the schema too: replace_all is left out and defaults to false
    const edit = await client.callTool({
      name: "edit_note",
      arguments: { id: "t2", old_text: "milk", new_text: "oat milk" },
    });
    assert.equal(
      JSON.parse((edit.content as { text: string }[])[0].text).replaced,
      1,
    );
    assert.equal(
      (await readNote(vault, { id: "t2" })).body,
      "- [ ] oat milk\n",
    );
    await client.close();
  }));

test("create_note and the edits refuse a vault folder that is not there", () =>
  withVault(async (vault) => {
    const gone = joinPath(vault, "renamed-away");
    await assert.rejects(
      createNote(gone, { title: "Plan", folder: "Work/New" }),
      /the vault folder is not there/,
    );
    assert.equal(existsSync(gone), false);
    // A new folder below a vault that is there is made, as before
    const made = await createNote(vault, { title: "Plan", folder: "Work/New" });
    assert.equal(made.folder, "Work/New");
  }));
