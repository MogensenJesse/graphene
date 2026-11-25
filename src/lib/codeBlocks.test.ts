// src/lib/codeBlocks.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  fenceLineNumbers,
  findFenceAt,
  firstCodeBlock,
  GUTTER_MAX_LINES,
  gutterNumbers,
  setFenceLang,
} from "./codeBlocks";

const F = "```";

/** Where the caret sits in `text`, marked with "|" (removed from the text). */
function at(marked: string) {
  const caret = marked.indexOf("|");
  return { text: marked.replace("|", ""), caret };
}
const found = (marked: string) => {
  const { text, caret } = at(marked);
  return findFenceAt(text, caret);
};

test("no fence, no block", () => {
  assert.equal(found("just |text"), null);
  assert.equal(found(""), null);
  assert.equal(findFenceAt("", 0), null);
});

test("the caret anywhere from the opening fence line to the closing one is in the block", () => {
  const text = `before\n${F}js\nlet x;\n${F}\nafter`;
  const start = text.indexOf(F);
  const end = text.indexOf(`${F}\nafter`) + 3; // the end of the closing fence line
  for (let caret = 0; caret <= text.length; caret++) {
    const inside = caret >= start && caret <= end;
    assert.equal(findFenceAt(text, caret) !== null, inside, `caret ${caret}`);
  }
});

test("the block says where its language tag is", () => {
  const block = found(`${F}ts\n|code\n${F}`);
  assert.deepEqual(block, { lang: "ts", langStart: 3, langEnd: 5 });
  // no tag: it would start right after the fence
  assert.deepEqual(found(`${F}\n|x\n${F}`), {
    lang: "",
    langStart: 3,
    langEnd: 3,
  });
  // a space before the tag and words after it
  assert.deepEqual(found(`${F} sh title=x\n|x\n${F}`), {
    lang: "sh",
    langStart: 4,
    langEnd: 6,
  });
  assert.equal(found(`~~~ py\n|x\n~~~`)?.lang, "py");
  // a block that is not the first has offsets in the whole text
  const second = found(`${F}\na\n${F}\n\n${F}go\n|b\n${F}`);
  assert.deepEqual(second, { lang: "go", langStart: 14, langEnd: 16 });
});

test("an unclosed fence runs to the end of the text", () => {
  assert.equal(found(`${F}js\nstill |open`)?.lang, "js");
  assert.equal(found(`before |${F}js\nopen`), null); // not a fence: it is not first on its line
  assert.equal(found(`before\n|${F}js\nopen`)?.lang, "js");
  assert.equal(found(`|before\n${F}js\nopen`), null); // the caret is above it
});

test("a closing fence has to be the same character and at least as long", () => {
  assert.equal(found(`${F}\n|a\n~~~\nb`)?.lang, ""); // ~~~ does not close ```
  assert.equal(found(`${F}\na\n${F}\n|b`), null);
  assert.equal(found(`${F}\n|a\n${F}\nb`)?.lang, "");
  assert.equal(found("````\n|a\n```\nb")?.lang, ""); // three do not close four: still open
  assert.equal(found("````\na\n```\nb\n`````\n|c"), null); // five do
  assert.equal(found("~~~\na\n~~~\n|b"), null);
});

test("an opening-looking line inside a block does not end it, and a closer has nothing after the fence", () => {
  assert.equal(found(`${F}\n|a\n${F}js\nb\n${F}\nc`)?.lang, ""); // ```js is not a closer
  assert.equal(found(`${F}\na\n${F}js\n|b\n${F}\nc`)?.lang, "");
  assert.equal(found(`${F}\na\n${F}  \n|b`), null); // trailing spaces are fine on a closer
});

test("a fence is indented by at most 3 spaces", () => {
  assert.equal(found(`   ${F}\n|x\n   ${F}`)?.lang, "");
  assert.equal(found(`    ${F}\n|x\n    ${F}`), null);
  assert.equal(found(`\t${F}\n|x\n\t${F}`), null);
  assert.equal(found(`text ${F}\n|x\n${F}`), null); // not at the start of the line
  assert.equal(found(`${F}\n|x\n    ${F}\ny`)?.lang, ""); // an indented fence does not close
});

test("blocks, one after the other: the caret picks its own", () => {
  const text = `${F}a\n1\n${F}\ntext\n${F}b\n2\n${F}\n`;
  assert.equal(findFenceAt(text, text.indexOf("1"))?.lang, "a");
  assert.equal(findFenceAt(text, text.indexOf("text"))?.lang, undefined);
  assert.equal(findFenceAt(text, text.indexOf("2"))?.lang, "b");
  // a bare fence after a closed block opens the next one
  assert.equal(found(`${F}\na\n${F}\n${F}\n|b`)?.lang, "");
});

test("CRLF text is not converted here: the caller does that, so a caret offset means the same in both", () => {
  // the closing fence line has a "\r" in it, which \s* accepts
  const text = `${F}js\r\ncode\r\n${F}\r\nafter`;
  assert.equal(findFenceAt(text, 8)?.lang, "js");
});

test("the end of the text and out-of-range carets", () => {
  const text = `${F}\nx\n${F}`;
  assert.notEqual(findFenceAt(text, text.length), null); // the end of the closing line
  assert.equal(findFenceAt(text, -1), null);
  assert.notEqual(findFenceAt(`${F}\nx`, 1000), null); // an unclosed block runs on
  assert.equal(findFenceAt(text, 1000), null);
});

test("a very long line without a fence, and a long run of fence characters, are quick", () => {
  const long = "x".repeat(2_000_000);
  assert.equal(findFenceAt(`${long}\n${F}\na\n${F}`, 5), null);
  assert.equal(
    findFenceAt(`y${"`".repeat(2_000_000)}\n${F}\nq`, 2_000_005)?.lang,
    "",
  );
});

// ── The rewrite of findFenceAt (no split into lines, stops at the caret) must give the old answers ────────────────
// The old version, as it was: every line looked at.
function oldFindFenceAt(text: string, caret: number) {
  const OPENING_FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^\s`]*)/;
  const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})\s*$/;
  let open: {
    char: string;
    len: number;
    start: number;
    block: { lang: string; langStart: number; langEnd: number };
  } | null = null;
  let offset = 0;
  for (const line of text.split("\n")) {
    const lineEnd = offset + line.length;
    if (!open) {
      const m = OPENING_FENCE.exec(line);
      if (m) {
        const langStart = offset + m[0].length - m[3].length;
        open = {
          char: m[2][0],
          len: m[2].length,
          start: offset,
          block: { lang: m[3], langStart, langEnd: langStart + m[3].length },
        };
      }
    } else {
      const m = CLOSING_FENCE.exec(line);
      if (m && m[1][0] === open.char && m[1].length >= open.len) {
        if (caret >= open.start && caret <= lineEnd) return open.block;
        open = null;
      }
    }
    offset = lineEnd + 1;
  }
  return open && caret >= open.start ? open.block : null;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("random texts built from fences, spaces and newlines give the same block as the old version at every caret", () => {
  const rand = mulberry32(42);
  const PIECES = [
    "`",
    "``",
    "```",
    "````",
    "~",
    "~~~",
    "~~~~",
    " ",
    "  ",
    "    ",
    "\n",
    "\n",
    "\n",
    "\t",
    "\r",
    "js",
    "x y",
    " title=a",
    "-",
  ];
  let cases = 0;
  for (let n = 0; n < 4000; n++) {
    const pieces = 1 + Math.floor(rand() * 30);
    let text = "";
    for (let i = 0; i < pieces; i++)
      text += PIECES[Math.floor(rand() * PIECES.length)];
    for (let caret = -1; caret <= text.length + 1; caret++) {
      assert.deepEqual(
        findFenceAt(text, caret),
        oldFindFenceAt(text, caret),
        JSON.stringify({ text, caret }),
      );
      cases++;
    }
  }
  assert.ok(cases > 50_000);
});

test("setFenceLang replaces, adds and removes the tag", () => {
  const text = `${F}js\nx\n${F}`;
  const block = findFenceAt(text, 5);
  assert.ok(block);
  assert.equal(setFenceLang(text, block, "ts"), `${F}ts\nx\n${F}`);
  assert.equal(setFenceLang(text, block, ""), `${F}\nx\n${F}`);
  const bare = findFenceAt(`${F}\nx\n${F}`, 5);
  assert.ok(bare);
  assert.equal(setFenceLang(`${F}\nx\n${F}`, bare, "go"), `${F}go\nx\n${F}`);
});

test("firstCodeBlock is the code of the first block, CRLF or not", () => {
  assert.equal(firstCodeBlock(`text\n${F}js\na\nb\n${F}\nmore`), "a\nb");
  assert.equal(firstCodeBlock(`${F}\r\na\r\nb\r\n${F}`), "a\nb");
  assert.equal(firstCodeBlock("no block"), "");
  assert.equal(firstCodeBlock(`${F}\nunclosed\ncode`), "unclosed\ncode");
});

test("fenceLineNumbers numbers the lines inside a block from 1 and leaves the rest", () => {
  assert.deepEqual(fenceLineNumbers(""), [null]);
  assert.deepEqual(fenceLineNumbers("just\ntext"), [null, null]);
  assert.deepEqual(fenceLineNumbers(`a\n${F}js\nx\ny\n${F}\nb`), [
    null,
    null,
    1,
    2,
    null,
    null,
  ]);
  // an empty line inside a block counts; the text's trailing newline is an empty line of its own
  assert.deepEqual(fenceLineNumbers(`${F}\nx\n\ny\n${F}\n`), [
    null,
    1,
    2,
    3,
    null,
    null,
  ]);
});

test("every block starts again at 1, and an unclosed one runs to the end", () => {
  assert.deepEqual(fenceLineNumbers(`${F}\na\n${F}\n${F}\nb\nc\n${F}`), [
    null,
    1,
    null,
    null,
    1,
    2,
    null,
  ]);
  assert.deepEqual(fenceLineNumbers(`${F}\na\nb`), [null, 1, 2]);
});

test("fenceLineNumbers follows the closing rules of findFenceAt", () => {
  // a shorter fence, or another character, does not close; it is a line of the code
  assert.deepEqual(fenceLineNumbers("````\na\n```\nb\n````"), [
    null,
    1,
    2,
    3,
    null,
  ]);
  assert.deepEqual(fenceLineNumbers("~~~\na\n```\nb\n~~~"), [
    null,
    1,
    2,
    3,
    null,
  ]);
  // a fence with a tag does not close a block
  assert.deepEqual(fenceLineNumbers(`${F}\na\n${F}js\nb\n${F}`), [
    null,
    1,
    2,
    3,
    null,
  ]);
  // a fence indented four spaces is code, not a fence
  assert.deepEqual(fenceLineNumbers(`    ${F}\na`), [null, null]);
  // a Windows file: the carriage returns do not change what a line is
  assert.deepEqual(fenceLineNumbers(`${F}\r\na\r\n${F}\r\nb`), [
    null,
    1,
    null,
    null,
  ]);
});

test("gutterNumbers is null when there is nothing to number", () => {
  assert.equal(gutterNumbers("just text"), null);
  assert.equal(gutterNumbers(`${F}\n${F}`), null); // a block with no lines in it
  assert.deepEqual(gutterNumbers(`a\n${F}\nx\n${F}`), [null, null, 1, null]);
});

test("gutterNumbers leaves a note that is too big to draw", () => {
  const lines = "x\n".repeat(GUTTER_MAX_LINES);
  assert.notEqual(gutterNumbers(`${F}\n${lines.slice(0, 200)}${F}`), null);
  assert.equal(gutterNumbers(`${F}\n${lines}${F}`), null); // one line too many
  assert.equal(gutterNumbers(`${F}\n${"x".repeat(500_000)}\n${F}`), null); // too many characters
});
