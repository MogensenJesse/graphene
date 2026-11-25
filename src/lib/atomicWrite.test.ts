// src/lib/atomicWrite.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { type AtomicFs, tempPathFor, writeAtomic } from "./atomicWrite";

/** An in-memory file system; `fail` names the operation that throws, like a full disk or a locked file. */
function fakeFs(
  files: Record<string, string>,
  fail?: "writeText" | "rename",
): AtomicFs & { files: Map<string, string> } {
  const map = new Map(Object.entries(files));
  return {
    files: map,
    async writeText(path, text) {
      if (fail === "writeText") {
        map.set(path, text.slice(0, 3)); // a half-written file, as a full disk leaves it
        throw new Error("disk full");
      }
      map.set(path, text);
    },
    async rename(from, to) {
      if (fail === "rename") throw new Error("locked");
      const text = map.get(from);
      if (text === undefined) throw new Error("no such file");
      map.delete(from);
      map.set(to, text);
    },
    async remove(path) {
      if (!map.delete(path)) throw new Error("no such file");
    },
  };
}

test("the temp file is a dot file next to the target", () => {
  assert.equal(tempPathFor("D:/v/a/note-1.md"), "D:/v/a/.note-1.md.tmp");
  assert.equal(tempPathFor("note-1.md"), ".note-1.md.tmp");
});

test("writes the new text over the old and leaves no temp file", async () => {
  const fs = fakeFs({ "/v/n.md": "old" });
  await writeAtomic(fs, "/v/n.md", "new");
  assert.deepEqual([...fs.files], [["/v/n.md", "new"]]);
});

test("a failed write rejects, keeps the old file and removes the temp file", async () => {
  const fs = fakeFs({ "/v/n.md": "old" }, "writeText");
  await assert.rejects(writeAtomic(fs, "/v/n.md", "new"), /disk full/);
  assert.deepEqual([...fs.files], [["/v/n.md", "old"]]);
});

test("a failed write of a new file leaves nothing behind", async () => {
  const fs = fakeFs({}, "writeText");
  await assert.rejects(writeAtomic(fs, "/v/n.md", "new"), /disk full/);
  assert.equal(fs.files.size, 0);
});

test("a failed rename rejects, keeps the old file and removes the temp file", async () => {
  const fs = fakeFs({ "/v/n.md": "old" }, "rename");
  await assert.rejects(writeAtomic(fs, "/v/n.md", "new"), /locked/);
  assert.deepEqual([...fs.files], [["/v/n.md", "old"]]);
});

test("a temp file that cannot be removed does not hide the original error", async () => {
  const fs = fakeFs({ "/v/n.md": "old" }, "rename");
  fs.remove = async () => {
    throw new Error("also locked");
  };
  await assert.rejects(writeAtomic(fs, "/v/n.md", "new"), {
    message: "locked",
  });
});
