// src/lib/folderName.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import type { Folder } from "../types";
import { namesUnder, validateFolderName } from "./folderName";

const ok = (
  name: string,
  siblings: string[] = [],
  own?: string,
  parent: string | null = null,
) => validateFolderName(name, siblings, own, parent);

test("an ordinary name is fine, a blank one is not", () => {
  assert.equal(ok("Projects"), null);
  assert.equal(ok("My notes 2"), null);
  assert.equal(ok("a.b"), null);
  assert.ok(ok(""));
  assert.ok(ok("   "));
});

test("the characters Windows refuses in a name are refused", () => {
  for (const c of ["/", "\\", ":", "*", "?", '"', "<", ">", "|"])
    assert.ok(ok(`a${c}b`), `a${c}b`);
});

test("dot names: . and .. and a leading dot (hidden from the scan), a trailing dot or space", () => {
  assert.ok(ok("."));
  assert.ok(ok(".."));
  assert.ok(ok(".x"));
  assert.ok(ok("x."));
  assert.ok(ok("x "));
});

test("Windows device names are reserved, with or without an extension, in any case", () => {
  for (const n of ["CON", "prn", "Aux", "NUL", "com1", "COM9", "lpt1", "LPT9"])
    assert.ok(ok(n), n);
  assert.ok(ok("con.txt"));
  assert.equal(ok("com0"), null);
  assert.equal(ok("console"), null);
});

test("attachments is reserved at the vault root only", () => {
  assert.ok(ok("attachments"));
  assert.ok(ok("Attachments"));
  assert.equal(ok("attachments", [], undefined, "Notes"), null);
});

test("a sibling with the same name in another case is a duplicate", () => {
  assert.ok(ok("notes", ["Notes", "Work"]));
  assert.ok(ok("WORK", ["Notes", "Work"]));
  assert.equal(ok("Other", ["Notes", "Work"]), null);
});

test("a folder may take a new casing of its own name, but not another folder's name", () => {
  assert.equal(ok("notes", ["Notes", "Work"], "Notes"), null);
  assert.ok(ok("work", ["Notes", "Work"], "Notes"));
});

test("namesUnder lists the names that share a parent", () => {
  const f = (id: string, name: string, parentId: string | null): Folder => ({
    id,
    name,
    parentId,
    createdAt: "",
  });
  const folders = [f("A", "A", null), f("A/B", "B", "A"), f("C", "C", null)];
  assert.deepEqual(namesUnder(folders, null), ["A", "C"]);
  assert.deepEqual(namesUnder(folders, "A"), ["B"]);
  assert.deepEqual(namesUnder(folders, "Z"), []);
});
