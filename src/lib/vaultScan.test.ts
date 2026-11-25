// src/lib/vaultScan.test.ts
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

import {
  batchSize,
  foldersFromScan,
  itemFromScan,
  readBodies,
  type ScannedFolder,
  type ScannedNote,
  stampOf,
} from "./vaultScan";

const core = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: core.invoke }));

const scanned: ScannedNote = {
  id: "n1",
  title: "Plan",
  folderId: "work",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: null,
  order: 2048,
  kind: "code",
  path: "work/plan-n1.md",
  mtimeMs: 1,
  size: 10,
};

beforeEach(() => {
  core.invoke.mockReset(); // not returned: a function a hook returns is run as its cleanup
});

test("an item from the scan has the fields of the note and no text until it is read", () => {
  const before = Date.now();
  const item = itemFromScan(scanned);
  assert.equal(item.body, "");
  // It says so, and carries the kind the scan saw: nothing may write it before its text is in
  assert.deepEqual(item.unloaded, { kind: "code" });
  assert.equal(item.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(item.order, 2048);
  // A missing date is now, as in parseNoteFile
  const at = Date.parse(item.updatedAt);
  assert.ok(at >= before && at <= Date.now());
  // With its text it is a whole note (an empty text is a text too)
  const whole = itemFromScan(scanned, "text");
  assert.equal(whole.body, "text");
  assert.equal("unloaded" in whole, false);
  assert.equal("unloaded" in itemFromScan(scanned, ""), false);
});

test("a note with no rank gets no order key, an empty date stays empty", () => {
  const { order: _order, ...unranked } = scanned;
  const item = itemFromScan({ ...unranked, createdAt: "" });
  assert.equal("order" in item, false);
  assert.equal(item.createdAt, "");
});

test("folders from the scan get a createdAt and keep their rank", () => {
  const scan: ScannedFolder[] = [
    { id: "a", name: "a", parentId: null, order: 3 },
    { id: "a/b", name: "b", parentId: "a" },
  ];
  const folders = foldersFromScan(scan);
  assert.deepEqual(
    folders.map(({ createdAt: _at, ...rest }) => rest),
    scan,
  );
  assert.ok(folders.every((f) => !Number.isNaN(Date.parse(f.createdAt))));
});

test("the background load reads a few hundred notes per call and about twenty calls for a big vault", () => {
  assert.equal(batchSize(0), 300);
  assert.equal(batchSize(5000), 300);
  assert.equal(batchSize(20000), 1000);
  assert.equal(batchSize(50000), 2000);
  assert.equal(batchSize(500000), 2000);
});

test("bodies are read one batch at a time, in order, from the files of the scan", async () => {
  const stamps = new Map(
    ["a", "b", "c"].map((id) => [
      id,
      stampOf({ ...scanned, path: `${id}.md` }),
    ]),
  );
  core.invoke.mockImplementation(
    async (_cmd: string, args: { paths: string[] }) =>
      args.paths.map((p) => ({ text: `text of ${p}` })),
  );
  const { bodies, errors } = await readBodies("/v", ["a", "b", "c"], stamps, 2);
  assert.equal(errors.size, 0);
  assert.deepEqual(
    [...bodies],
    [
      ["a", "text of /v/a.md"],
      ["b", "text of /v/b.md"],
      ["c", "text of /v/c.md"],
    ],
  );
  assert.deepEqual(
    core.invoke.mock.calls.map(([cmd, args]) => [cmd, args.paths.length]),
    [
      ["read_notes", 2],
      ["read_notes", 1],
    ],
  );
});

test("a note that cannot be read, a file that is not known and a call that fails each end up in errors, never as an empty text", async () => {
  const stamps = new Map([
    ["ok", stampOf({ ...scanned, path: "ok.md" })],
    ["bad", stampOf({ ...scanned, path: "bad.md" })],
    ["late", stampOf({ ...scanned, path: "late.md" })],
  ]);
  core.invoke
    .mockResolvedValueOnce([{ text: "fine" }, { error: "denied" }])
    .mockRejectedValueOnce("the command failed");
  const { bodies, errors } = await readBodies(
    "/v",
    ["ok", "bad", "late", "unknown"],
    stamps,
    2,
  );
  assert.deepEqual([...bodies.keys()], ["ok"]);
  assert.equal(errors.get("bad"), "denied");
  assert.equal(errors.get("late"), "the command failed");
  assert.match(errors.get("unknown") ?? "", /not known/);
  assert.equal(bodies.has("bad"), false);
  // nothing to read: no call at all
  core.invoke.mockClear();
  await readBodies("/v", [], stamps);
  assert.equal(core.invoke.mock.calls.length, 0);
});
