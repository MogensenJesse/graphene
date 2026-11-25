// src/lib/noteStamp.test.ts
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import type { Item } from "../types";
import type { FileStamp, ScannedNote } from "./vaultScan";

// A plain function, not vi.fn: a vi.fn whose implementation throws fails the test even when the caller catches it
const fs = vi.hoisted(() => {
  const calls: string[] = [];
  const state = {
    answer: (_path: string): unknown => undefined,
  };
  return {
    calls,
    state,
    stat: async (path: string) => {
      calls.push(path);
      return state.answer(path);
    },
  };
});
vi.mock("@tauri-apps/plugin-fs", () => ({ stat: fs.stat }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const {
  POLL_MS,
  noteStamp,
  pollWantsRescan,
  sameStamp,
  shouldPoll,
  stampFromStat,
  statStamp,
} = await import("./noteStamp");
const { changedNotes } = await import("./mergeScan");

const stamp = (mtimeMs = 1000, size = 10, path = "a-n1.md"): FileStamp => ({
  path,
  mtimeMs,
  size,
});

beforeEach(() => {
  fs.calls.length = 0;
  fs.state.answer = () => undefined;
});

test("a stamp from stat is what the scan would have made, and none without a modified time", () => {
  assert.deepEqual(
    stampFromStat("w/a-n1.md", { mtime: new Date(1700000000123), size: 42 }),
    { path: "w/a-n1.md", mtimeMs: 1700000000123, size: 42 },
  );
  assert.equal(stampFromStat("a.md", { mtime: null, size: 1 }), null);
  assert.ok(sameStamp(stamp(), stamp()));
  assert.ok(!sameStamp(stamp(), stamp(1001)));
  assert.ok(!sameStamp(stamp(), stamp(1000, 11)));
  assert.ok(!sameStamp(stamp(), stamp(1000, 10, "b.md")));
  assert.ok(sameStamp(null, null));
  assert.ok(!sameStamp(null, stamp()));
  assert.ok(!sameStamp(undefined, null));
});

test("noteStamp stats the file the note is written to, from the vault's own path", async () => {
  fs.state.answer = () => ({ mtime: new Date(5000), size: 7 });
  const note = {
    id: "n1",
    title: "Big Plan",
    folderId: "Work/Specs",
    body: "",
    createdAt: "",
    updatedAt: "",
  } satisfies Item;
  assert.deepEqual(await noteStamp("C:\\vault\\", note), {
    path: "Work/Specs/big-plan-n1.md",
    mtimeMs: 5000,
    size: 7,
  });
  assert.deepEqual(fs.calls, ["C:/vault/Work/Specs/big-plan-n1.md"]);
  assert.deepEqual(await noteStamp("/v", { ...note, folderId: null }), {
    path: "big-plan-n1.md",
    mtimeMs: 5000,
    size: 7,
  });
  // A file that cannot be looked at gives none (the next rescan reads the note, as before)
  fs.state.answer = () => {
    throw new Error("gone");
  };
  assert.equal(await statStamp("/v", "x.md"), null);
});

test("the poll looks only while a note is open in a shown window with nothing else running", () => {
  assert.equal(POLL_MS, 3000);
  const on = { openId: "n1", hidden: false, ready: true, busy: false };
  assert.ok(shouldPoll(on));
  assert.ok(!shouldPoll({ ...on, openId: null }));
  assert.ok(!shouldPoll({ ...on, hidden: true }));
  assert.ok(!shouldPoll({ ...on, ready: false }));
  assert.ok(!shouldPoll({ ...on, busy: true }));
});

test("a poll asks for a rescan once per change, never for our own write or a note with no stamp", () => {
  const ours = stamp(1000, 10);
  // Our write refreshed the stamp, so the file is as Graphene knows it
  assert.ok(!pollWantsRescan(ours, stamp(1000, 10), undefined));
  // Another program wrote it
  assert.ok(pollWantsRescan(ours, stamp(2000, 12), undefined));
  assert.ok(pollWantsRescan(ours, stamp(1000, 11), undefined));
  // The same changed state again, the rescan having been asked for already: quiet
  assert.ok(!pollWantsRescan(ours, stamp(2000, 12), stamp(2000, 12)));
  // Changed again after that: asked for again
  assert.ok(pollWantsRescan(ours, stamp(3000, 12), stamp(2000, 12)));
  // Gone (renamed, deleted, the vault folder missing): once, then quiet until it comes back or changes
  assert.ok(pollWantsRescan(ours, null, undefined));
  assert.ok(!pollWantsRescan(ours, null, null));
  assert.ok(pollWantsRescan(ours, stamp(2000, 12), null));
  // A new note whose file has not been stamped yet has nothing to compare with
  assert.ok(!pollWantsRescan(undefined, stamp(), undefined));
  assert.ok(!pollWantsRescan(undefined, null, undefined));
});

test("after our own writes a rescan reads only what changed outside, and an outside change right after our write is read", () => {
  const scanned = (id: string, mtimeMs: number, size: number): ScannedNote => ({
    id,
    title: id,
    folderId: null,
    createdAt: null,
    updatedAt: null,
    kind: "note",
    path: `${id}.md`,
    mtimeMs,
    size,
  });
  const inMemory = new Set(["a", "b", "c", "d"]);
  // What the last scan saw, then our writes of a, b and c refreshed their stamps (a stat after each write)
  const known = new Map<string, FileStamp>([
    ["a", stamp(100, 5, "a.md")],
    ["b", stamp(100, 5, "b.md")],
    ["c", stamp(100, 5, "c.md")],
    ["d", stamp(100, 5, "d.md")],
  ]);
  known.set("a", stamp(900, 8, "a.md"));
  known.set("b", stamp(910, 9, "b.md"));
  known.set("c", stamp(920, 6, "c.md"));
  const disk = [
    scanned("a", 900, 8), // our write
    scanned("b", 910, 9), // our write
    scanned("c", 950, 6), // our write, then another program wrote it a moment later
    scanned("d", 400, 5), // another program, never ours
  ];
  assert.deepEqual(
    changedNotes(disk, known, inMemory).map((n) => n.id),
    ["c", "d"],
  );
});
