// src/lib/editConflict.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import type { Item } from "../types";
import { conflictCopyTitle, leaveAction, outsideChange } from "./editConflict";

const note = (over: Partial<Item> = {}): Item => ({
  id: "n1",
  title: "Plan",
  folderId: null,
  body: "text",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});
const open = (over: Partial<Parameters<typeof outsideChange>[0]> = {}) => ({
  mine: note(),
  disk: note({ body: "theirs" }),
  dirty: true,
  unsaved: false,
  ...over,
});

test("a dirty editor whose note differs on disk from what was last saved is a conflict, and it is their version", () => {
  const theirs = note({ body: "theirs" });
  assert.equal(outsideChange(open({ disk: theirs })), theirs);
  // any of what the editor shows counts: the title, the folder, the rank
  assert.ok(outsideChange(open({ disk: note({ title: "Roadmap" }) })));
  assert.ok(outsideChange(open({ disk: note({ folderId: "Work" }) })));
  assert.ok(outsideChange(open({ disk: note({ order: 2048 }) })));
});

test("no conflict when the file is what Graphene saved (our own autosave, or nobody touched it), whatever the dates say", () => {
  assert.equal(
    outsideChange(
      open({ disk: note({ updatedAt: "2026-02-02T00:00:00.000Z" }) }),
    ),
    null,
  );
});

test("no conflict, and no question, when the editor is clean, the last write failed, or the file is gone", () => {
  assert.equal(outsideChange(open({ dirty: false })), null); // the editor just reopens on their text
  assert.equal(outsideChange(open({ unsaved: true })), null); // memory is ahead of the disk: the retry answers
  assert.equal(outsideChange(open({ disk: undefined })), null);
  assert.equal(outsideChange(open({ mine: undefined })), null);
});

test("a note whose text has not been read is never compared (its empty body would differ from any file)", () => {
  assert.equal(
    outsideChange(
      open({ mine: note({ body: "", unloaded: { kind: "note" } }) }),
    ),
    null,
  );
  assert.equal(
    outsideChange(
      open({ disk: note({ body: "", unloaded: { kind: "note" } }) }),
    ),
    null,
  );
});

test("leaving with a question open never saves over the file: typing becomes a copy, no typing just reloads", () => {
  assert.equal(leaveAction(true, true), "copy");
  assert.equal(leaveAction(true, false), "reload");
  assert.equal(leaveAction(false, true), "save");
  assert.equal(leaveAction(false, false), "none");
});

test("the copy is named after the note, and an empty title still gets a name", () => {
  assert.equal(conflictCopyTitle("Plan"), "Plan (conflict copy)");
  assert.equal(conflictCopyTitle("  Plan "), "Plan (conflict copy)");
  assert.equal(conflictCopyTitle(""), "Untitled (conflict copy)");
});
