// src/lib/rehypeCodeLines.ts
// Puts each line of a fenced code block in its own <span class="code-line">, so the stylesheet can number the lines with a
// CSS counter (the number is not text: it is not in a selection, the copy button or Find) and hang a wrapped row under the
// first one. It runs after rehype-highlight: a token that runs over several lines (a block comment, a template string) is
// cut into one piece per line. The newline stays a text node between the lines, so the text of the block is what it was.
import type { Element, ElementContent, Root } from "hast";
import { GUTTER_MAX_LINES } from "./codeBlocks";

/** `nodes` cut at every "\n": one list of nodes per line. A tag that spans a newline is copied into each line it touches. */
function splitLines(nodes: ElementContent[]): ElementContent[][] {
  const lines: ElementContent[][] = [[]];
  const add = (node: ElementContent) => lines[lines.length - 1].push(node);
  for (const node of nodes) {
    if (node.type === "text") {
      node.value.split("\n").forEach((part, i) => {
        if (i > 0) lines.push([]);
        if (part) add({ type: "text", value: part });
      });
    } else if (node.type === "element" && node.children.length > 0) {
      const pieces = splitLines(node.children);
      if (pieces.length === 1) add(node);
      else
        pieces.forEach((piece, i) => {
          if (i > 0) lines.push([]);
          if (piece.length > 0) add({ ...node, children: piece });
        });
    } else add(node);
  }
  return lines;
}

function numberLines(code: Element): void {
  const lines = splitLines(code.children);
  const endsWithNewline =
    lines.length > 1 && lines[lines.length - 1].length === 0;
  if (endsWithNewline) lines.pop();
  if (lines.length > GUTTER_MAX_LINES) return;
  if (lines.length === 1 && lines[0].length === 0) return; // an empty block has no line to number

  const children: ElementContent[] = [];
  lines.forEach((line, i) => {
    if (i > 0) children.push({ type: "text", value: "\n" });
    children.push({
      type: "element",
      tagName: "span",
      properties: { className: ["code-line"] },
      children: line,
    });
  });
  if (endsWithNewline) children.push({ type: "text", value: "\n" });
  code.children = children;
  // The width of the widest number, in characters, for the stylesheet
  code.properties.style = `--code-digits:${String(lines.length).length}`;
}

function walk(parent: Root | Element): void {
  for (const node of parent.children) {
    if (node.type !== "element") continue;
    const code =
      node.tagName === "pre"
        ? node.children.find(
            (child): child is Element =>
              child.type === "element" && child.tagName === "code",
          )
        : undefined;
    if (code) numberLines(code);
    else walk(node);
  }
}

export default function rehypeCodeLines() {
  return (tree: Root) => walk(tree);
}
