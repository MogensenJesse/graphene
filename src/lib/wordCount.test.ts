// src/lib/wordCount.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { lineCount, wordCount } from "./wordCount";

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

test("wordCount: the list markers of every kind and depth, task boxes in either case", () => {
  assert.equal(wordCount("* a\n+ b\n- c\n1) d\n12. e"), 5);
  assert.equal(wordCount("  - [X] indented\n\t- [ ] tabbed"), 2);
  assert.equal(wordCount("    - [x] deep task"), 2); // four spaces is still a list line here
  // a marker with nothing after it is no word, and a number that is not a marker is
  assert.equal(wordCount("-\n- \n1.\n2024"), 1);
  assert.equal(wordCount("1.5 litres"), 2);
  assert.equal(wordCount("-5 degrees"), 2);
});

test("wordCount: fence lines of both kinds are dropped, the code between them counts", () => {
  assert.equal(wordCount("~~~\ncode here\n~~~"), 2);
  assert.equal(wordCount("  ```js title\nlet x = 1;\n```"), 3); // let, x, 1;
  assert.equal(wordCount("text ``` not a fence line"), 5);
});

test("wordCount: tokens need a letter or digit, in any script", () => {
  assert.equal(wordCount("-- == ** ... !!!"), 0);
  assert.equal(wordCount("(a) [b] {c} <d>"), 4);
  assert.equal(wordCount("日本語 テキスト 한국어"), 3);
  assert.equal(wordCount("emoji 🎉 only"), 2);
  assert.equal(wordCount("a-b c_d e/f"), 3);
});

test("wordCount reads CRLF text like LF text", () => {
  const lf = "- [ ] dit\n- [x] is\n\n```sh\nls -la\n```\nlast line";
  assert.equal(wordCount(lf.replace(/\n/g, "\r\n")), wordCount(lf));
  assert.equal(wordCount("a\r\nb\r\n"), 2);
});

test("lineCount skips fences and blank lines", () => {
  assert.equal(lineCount("```bash\na\nb\n\nc\n```"), 3);
  assert.equal(lineCount(""), 0);
  assert.equal(lineCount("```\n\n   \n```"), 0);
  assert.equal(lineCount("~~~\none\r\ntwo\r\n~~~"), 2);
  assert.equal(lineCount("  indented\n\tline"), 2);
});
