// src/lib/utils.test.ts
import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { formatDate, itemKind } from "./utils";

afterEach(() => vi.useRealTimers());

test("formatDate counts calendar days", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 18, 9, 0));
  const at = (d: number, h: number, m = 0) =>
    new Date(2026, 10, d, h, m).toISOString();
  assert.equal(formatDate(at(18, 0, 5)), "today");
  assert.equal(formatDate(at(17, 23)), "1d ago"); // 10 hours ago, but yesterday
  assert.equal(formatDate(at(18, 23)), "today"); // clock skew: never "-1d ago"
  assert.equal(formatDate(at(15, 12)), "3d ago");
  assert.equal(formatDate(at(4, 12)), "2w ago");
});

test("a note whose text has not been read has the kind the scan saw", () => {
  const base = {
    id: "a",
    title: "t",
    folderId: null,
    createdAt: "",
    updatedAt: "",
  };
  assert.equal(itemKind({ ...base, body: "```js\nx\n```" }), "code");
  assert.equal(itemKind({ ...base, body: "text" }), "note");
  // its body is "", so the text says nothing: the scan's kind counts
  assert.equal(
    itemKind({ ...base, body: "", unloaded: { kind: "code" } }),
    "code",
  );
  assert.equal(
    itemKind({ ...base, body: "", unloaded: { kind: "note" } }),
    "note",
  );
});
