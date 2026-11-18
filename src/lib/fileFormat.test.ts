// src/lib/fileFormat.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { parseNoteFile, serializeItem } from "./fileFormat";

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
