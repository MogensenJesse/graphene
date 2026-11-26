// src/lib/markdownFormat.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { activeFormats, formatText } from "./markdownFormat";

test("formatText and activeFormats", () => {
  const f = (
    v: string,
    ss: number,
    se: number,
    t: Parameters<typeof formatText>[3],
  ) => formatText(v, ss, se, t);
  const sel = (r: { value: string; ss: number; se: number }) =>
    r.value.slice(r.ss, r.se);

  // inline: wrap keeps the inner text selected, second press unwraps
  let r = f("a word b", 2, 6, "bold");
  assert.equal(r.value, "a **word** b");
  assert.equal(sel(r), "word");
  r = f(r.value, r.ss, r.se, "bold");
  assert.equal(r.value, "a word b");
  assert.equal(sel(r), "word");

  // selection that includes the markers also unwraps
  r = f("a **word** b", 2, 10, "bold");
  assert.equal(r.value, "a word b");
  assert.equal(sel(r), "word");

  // no selection: empty pair, caret between, second press removes the pair
  r = f("ab", 1, 1, "bold");
  assert.equal(r.value, "a****b");
  assert.equal(r.ss, 3);
  r = f(r.value, r.ss, r.se, "bold");
  assert.equal(r.value, "ab");
  assert.equal(r.ss, 1);

  // italic is not fooled by bold
  r = f("**x**", 2, 3, "italic");
  assert.equal(r.value, "***x***");
  r = f("*x*", 1, 2, "italic");
  assert.equal(r.value, "x");

  // spaces stay outside the markers
  r = f("a word b", 1, 7, "bold");
  assert.equal(r.value, "a **word** b");

  // code block wraps a selection on its own lines
  r = f("before\ncode here\nafter", 7, 16, "codeblock");
  assert.equal(r.value, "before\n```\ncode here\n```\nafter");
  assert.equal(r.ss, 7 + 3);
  // mid-line selection gets newlines around the fences
  r = f("say foo now", 4, 7, "codeblock");
  assert.equal(r.value, "say \n```\nfoo\n```\n now");
  // triple-click (trailing newline) does not add a blank line
  r = f("x\ny\nz", 2, 4, "codeblock");
  assert.equal(r.value, "x\n```\ny\n```\nz");
  // empty: seed block, caret inside
  r = f("", 0, 0, "codeblock");
  assert.equal(r.value, "```\n\n```");
  assert.equal(r.ss, 4);

  // lists
  r = f("a\n\nb", 0, 4, "ul");
  assert.equal(r.value, "- a\n\n- b");
  r = f(r.value, r.ss, r.se, "ul");
  assert.equal(r.value, "a\n\nb");
  r = f("a\nb\nc", 0, 5, "ol");
  assert.equal(r.value, "1. a\n2. b\n3. c");
  r = f(r.value, r.ss, r.se, "ol");
  assert.equal(r.value, "a\nb\nc");
  r = f("a\nb", 0, 3, "blockquote");
  assert.equal(r.value, "> a\n> b");
  // partly prefixed: the rest get it, no doubles
  r = f("- a\nb", 0, 5, "ul");
  assert.equal(r.value, "- a\n- b");
  // empty first line (the old lastIndexOf bug): caret at 0 of "\nfoo"
  r = f("\nfoo", 0, 0, "ul");
  assert.equal(r.value, "- \nfoo");
  assert.equal(r.ss, 2);
  // caret on a line stays on its text
  r = f("hello", 3, 3, "ul");
  assert.equal(r.value, "- hello");
  assert.equal(r.ss, 5);

  // headings replace, not stack, and toggle off at the same level
  r = f("## x", 0, 0, "h1");
  assert.equal(r.value, "# x");
  r = f("# x", 3, 3, "h1");
  assert.equal(r.value, "x");
  r = f("x", 0, 0, "h3");
  assert.equal(r.value, "### x");

  // divider: blank line above so text does not become a heading; selection text is kept
  r = f("title", 5, 5, "hr");
  assert.equal(r.value, "title\n\n---\n\n");
  assert.equal(r.ss, r.value.length);
  r = f("a b", 0, 1, "hr");
  assert.ok(r.value.startsWith("a\n\n---"));
  r = f("", 0, 0, "hr");
  assert.equal(r.value, "---\n\n");

  // link
  r = f("see docs", 4, 8, "link");
  assert.equal(r.value, "see [docs](url)");
  assert.equal(sel(r), "url");
  r = f("", 0, 0, "link");
  assert.equal(sel(r), "text");

  // ---- caret inside a span: pressing the format takes it off ----
  r = f("a **word** b", 6, 6, "bold"); // caret inside "word"
  assert.equal(r.value, "a word b");
  assert.equal(r.ss, 4);
  r = f("a **word** b", 4, 4, "bold"); // caret at the inner start
  assert.equal(r.value, "a word b");
  r = f("x *it* y ~~st~~ `c`", 5, 5, "italic");
  assert.equal(r.value, "x it y ~~st~~ `c`");
  r = f("x *it* y ~~st~~ `c`", 12, 12, "strikethrough");
  assert.equal(r.value, "x *it* y st `c`");
  r = f("x *it* y ~~st~~ `c`", 18, 18, "code");
  assert.equal(r.value, "x *it* y ~~st~~ c");
  // caret just outside the markers is not inside: it wraps
  r = f("**a** b", 5, 5, "bold");
  assert.equal(r.value, "**a****** b");
  // two spans on a line: the caret picks its own
  r = f("**a** and **b**", 13, 13, "bold");
  assert.equal(r.value, "**a** and b");

  const on = (v: string, ss: number, se = ss) =>
    [...activeFormats(v, ss, se)].sort();
  assert.deepEqual(on("plain text", 3), []);
  assert.deepEqual(on("a **word** b", 6), ["bold"]);
  assert.deepEqual(on("a **word** b", 1), []); // outside
  assert.deepEqual(on("a **word** b", 2), []); // inside the opening markers' edge
  assert.deepEqual(on("a **word** b", 4, 8), ["bold"]); // text selected
  assert.deepEqual(on("a **word** b", 2, 10), ["bold"]); // whole span selected
  assert.deepEqual(on("**a**|", 5), []);
  assert.deepEqual(on("*it*", 2), ["italic"]);
  assert.deepEqual(on("**bo**", 3), ["bold"]); // bold is not italic
  assert.deepEqual(on("~~s~~", 3), ["strikethrough"]);
  assert.deepEqual(on("`c`", 2), ["code"]);
  assert.deepEqual(on("a****b", 3), ["bold"]); // empty pair
  assert.deepEqual(on("- item", 4), ["ul"]);
  assert.deepEqual(on("1. item", 4), ["ol"]);
  assert.deepEqual(on("> q", 3), ["blockquote"]);
  assert.deepEqual(on("## h", 4), ["h2"]); // exact level only
  assert.deepEqual(on("# h", 3), ["h1"]);
  assert.deepEqual(on("- **bold item**", 8), ["bold", "ul"]);
  assert.deepEqual(on("", 0), []);
  assert.deepEqual(on("a\n\nb", 2), []); // blank line
  assert.deepEqual(on("- a\n- b", 0, 7), ["ul"]); // every line
  assert.deepEqual(on("- a\nb", 0, 5), []); // one line lacks it
  assert.deepEqual(on("- a\n\n- b", 0, 8), ["ul"]); // blank lines skipped
  assert.deepEqual(on("**a\nb**", 1, 6), []); // spans never cross lines
});

test("indent and outdent are the Tab key for a screen without one", () => {
  const list = formatText("- a\n- b", 7, 7, "indent");
  assert.equal(list.value, "- a\n  - b"); // a list line moves in
  assert.equal(list.ss, 9);
  assert.equal(formatText("- a\n  - b", 9, 9, "outdent").value, "- a\n- b");
  assert.equal(formatText("- a", 3, 3, "outdent").value, "- a"); // nothing to take out
  const plain = formatText("abc", 1, 1, "indent");
  assert.deepEqual(plain, { value: "a  bc", ss: 3, se: 3 }); // not a list: two spaces
  assert.deepEqual(formatText("abc", 1, 2, "indent").value, "a  c"); // they replace a selection, like Tab does
  assert.deepEqual(formatText("abc", 1, 1, "outdent"), {
    value: "abc",
    ss: 1,
    se: 1,
  });
});
