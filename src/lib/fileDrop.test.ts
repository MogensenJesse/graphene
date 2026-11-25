// src/lib/fileDrop.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { dropKind, dropNotice } from "./fileDrop";

test("a dropped file is a note, a code note, a picture or nothing, by its extension", () => {
  assert.equal(dropKind("C:\\x\\Plan.md"), "note");
  assert.equal(dropKind("C:/x/PLAN.MD"), "note");
  assert.equal(dropKind("/x/app.ts"), "code");
  assert.equal(dropKind("/x/run.sh"), "code");
  assert.equal(dropKind("C:\\x\\shot.PNG"), "image");
  assert.equal(dropKind("/x/notes.txt"), "other");
  assert.equal(dropKind("/x/Makefile"), "other");
  assert.equal(dropKind("/x/archive.zip"), "other");
});

test("the note after a drop names what was left out, and is null when everything was taken", () => {
  assert.equal(dropNotice([], 0), null);
  assert.equal(
    dropNotice(["notes.txt"], 0),
    '"notes.txt" was not imported. Graphene imports .md files and code files (.js, .ts, .css, .scss, .html, .sh).',
  );
  assert.match(
    dropNotice(["a.txt", "b.zip"], 0) ?? "",
    /^2 files were not imported\./,
  );
  assert.equal(
    dropNotice([], 1),
    "Open a note in the editor to add a picture to it.",
  );
  assert.match(
    dropNotice(["a.txt"], 3) ?? "",
    /not imported\. .*Open a note in the editor to add pictures to it\.$/,
  );
});
