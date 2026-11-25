// src/lib/rehypeCodeLines.test.ts
import type { Element, ElementContent, Root } from "hast";
import { expect, test } from "vitest";
import { GUTTER_MAX_LINES } from "./codeBlocks";
import rehypeCodeLines from "./rehypeCodeLines";

const text = (value: string): ElementContent => ({ type: "text", value });
const el = (
  tagName: string,
  children: ElementContent[],
  className?: string[],
): Element => ({
  type: "element",
  tagName,
  properties: className ? { className } : {},
  children,
});

// What react-markdown hands over: <pre><code>…</code></pre>
function run(...codeChildren: ElementContent[]): Element {
  const code = el("code", codeChildren);
  const tree: Root = { type: "root", children: [el("pre", [code])] };
  rehypeCodeLines()(tree);
  return code;
}

const content = (node: ElementContent): string =>
  node.type === "text"
    ? node.value
    : node.type === "element"
      ? node.children.map(content).join("")
      : "";
const lines = (code: Element) =>
  code.children.filter(
    (c): c is Element => c.type === "element" && c.tagName === "span",
  );

test("each line gets a span, and the text of the block does not change", () => {
  const code = run(text("one\ntwo\n\nfour\n"));
  expect(lines(code).map(content)).toEqual(["one", "two", "", "four"]);
  expect(code.children.map(content).join("")).toBe("one\ntwo\n\nfour\n");
  expect(lines(code)[0].properties.className).toEqual(["code-line"]);
  expect(code.properties.style).toBe("--code-digits:1");
});

test("a block without a closing newline keeps it that way", () => {
  const code = run(text("a\nb"));
  expect(code.children.map(content).join("")).toBe("a\nb");
  expect(lines(code)).toHaveLength(2);
});

test("a token that runs over lines is cut, one piece in each", () => {
  const comment = el("span", [text("/* a\nb\nc */")], ["hljs-comment"]);
  const code = run(
    el("span", [text("x")], ["hljs-k"]),
    text(" "),
    comment,
    text("\n"),
  );
  const rows = lines(code);
  expect(rows.map(content)).toEqual(["x /* a", "b", "c */"]);
  // the pieces keep the class, so each is coloured
  const pieces = rows.flatMap((row) =>
    row.children.filter((c): c is Element => c.type === "element"),
  );
  expect(
    pieces.filter((p) => p.properties.className?.toString() === "hljs-comment"),
  ).toHaveLength(3);
  expect(code.children.map(content).join("")).toBe("x /* a\nb\nc */\n");
});

test("the width of the numbers follows the line count", () => {
  const ten = run(text(`${"x\n".repeat(10)}`));
  expect(lines(ten)).toHaveLength(10);
  expect(ten.properties.style).toBe("--code-digits:2");
});

test("an empty block and a very long block are left as they are", () => {
  const empty = run();
  expect(empty.children).toEqual([]);
  expect(empty.properties.style).toBeUndefined();

  const long = `${"x\n".repeat(GUTTER_MAX_LINES + 1)}`;
  const big = run(text(long));
  expect(lines(big)).toHaveLength(0);
  expect(content(big)).toBe(long);
});

test("code that is not in a pre is not numbered", () => {
  const inline = el("code", [text("a\nb")]);
  const tree: Root = { type: "root", children: [el("p", [inline])] };
  rehypeCodeLines()(tree);
  expect(inline.children.map(content)).toEqual(["a\nb"]);
});
