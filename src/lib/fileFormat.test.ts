// src/lib/fileFormat.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "vitest";
import { parseNoteFile, serializeItem } from "./fileFormat";
import { itemKind } from "./utils";

const item = {
  id: "abc",
  title: "A: title",
  folderId: "work/notes",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  body: "# Hi\n\n- [ ] one\n",
};

test("a note survives serialize then parse", () => {
  assert.deepEqual(parseNoteFile(serializeItem(item)), item);
});

test("a file with Windows line endings parses like one with LF", () => {
  const crlf = serializeItem(item).replace(/\n/g, "\r\n");
  assert.deepEqual(parseNoteFile(crlf), item);
});

test("a byte order mark is ignored", () => {
  assert.equal(parseNoteFile(`﻿${serializeItem(item)}`).id, "abc");
});

test("a file without frontmatter has no id (the scan skips it)", () => {
  const parsed = parseNoteFile("just text");
  assert.equal(parsed.id, "");
  assert.equal(parsed.body, "just text");
});

test("a rank is written only when set and read back as a number", () => {
  assert.doesNotMatch(serializeItem(item), /^order:/m);
  assert.equal("order" in parseNoteFile(serializeItem(item)), false);
  const ranked = { ...item, order: 1536.5 };
  assert.match(serializeItem(ranked), /^order: 1536\.5$/m);
  assert.deepEqual(parseNoteFile(serializeItem(ranked)), ranked);
  const junk = serializeItem(item).replace("---\n", "---\norder: soon\n");
  assert.equal("order" in parseNoteFile(junk), false);
});

test("a root-level note stores folderId null", () => {
  const raw = serializeItem({ ...item, folderId: null });
  assert.match(raw, /^folderId: null$/m);
  assert.equal(parseNoteFile(raw).folderId, null);
});

// The shared fixtures. The Rust scan (src-tauri/tests/vault_scan.rs) and the MCP scan (mcp/vault.test.ts) are held to the same files and
// the same expected values, so the three implementations of the vault rules (and the frontmatter subset) cannot drift apart.
const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

interface ExpectedNote {
  id: string;
  title: string;
  folderId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  order?: number;
  kind: string;
  path: string;
  body: string;
}

const expected: { notes: ExpectedNote[]; noId: string[] } = JSON.parse(
  readFileSync(`${FIXTURES}/vault.expected.json`, "utf8"),
);

// How the app reads a file: Tauri's readTextFile hands the bytes to a TextDecoder, which is lossy and drops a byte order mark
const readFixture = (path: string) =>
  parseNoteFile(
    new TextDecoder().decode(readFileSync(`${FIXTURES}/vault/${path}`)),
  );

test("every fixture note parses to the expected values", () => {
  for (const want of expected.notes) {
    const parsed = readFixture(want.path);
    const at = want.path.lastIndexOf("/");
    // The folder a note sits in wins over the one in its frontmatter (readItemFile in storage.ts)
    const folderId = at < 0 ? parsed.folderId : want.path.slice(0, at);
    assert.equal(parsed.id, want.id, want.path);
    assert.equal(parsed.title, want.title, want.path);
    assert.equal(folderId, want.folderId, want.path);
    assert.equal(parsed.order, want.order, want.path);
    assert.equal(parsed.body, want.body, want.path);
    assert.equal(itemKind(parsed), want.kind, want.path);
    for (const key of ["createdAt", "updatedAt"] as const) {
      // A line the file lacks becomes the time of the parse; the Rust scan says null
      if (want[key] === null)
        assert.ok(!Number.isNaN(Date.parse(parsed[key])), want.path);
      else assert.equal(parsed[key], want[key], want.path);
    }
  }
});

test("the fixture files that are no note have no id", () => {
  assert.ok(expected.noId.length > 0);
  for (const path of expected.noId)
    assert.equal(readFixture(path).id, "", path);
});
