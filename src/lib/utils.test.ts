// src/lib/utils.test.ts
import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { formatDate, lineCount, wordCount } from "./utils";

afterEach(() => vi.useRealTimers());

test("wordCount counts words, not markdown syntax", () => {
  assert.equal(wordCount(""), 0);
  assert.equal(wordCount("one two  three\nfour"), 4);
  assert.equal(
    wordCount("- [ ] dit\n- [x] is\n- [ ] een\n- [x] todo\n- [x] lijst"),
    5,
  );
  assert.equal(wordCount("# Heading\n\n**bold** text\n\n---"), 3);
  assert.equal(wordCount("1. first\n2. second"), 2);
  assert.equal(wordCount("```bash\nViVeTool.exe /query\n```"), 2);
  assert.equal(wordCount("héllo wörld 123"), 3);
});

test("lineCount skips fences and blank lines", () => {
  assert.equal(lineCount("```bash\na\nb\n\nc\n```"), 3);
  assert.equal(lineCount(""), 0);
});

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
