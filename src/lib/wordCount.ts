// src/lib/wordCount.ts
// What the status line under a note counts. Pure, so it can be tested and timed (hotPaths.bench.ts): on a note of a few
// megabytes it takes a good fraction of a second, which is why the editor runs it after a pause in typing, not on every key.

const FENCE_LINE = /^\s*(```|~~~)/;

/** Words in a note body: tokens with a letter or digit. Fence lines, list and task markers and bare "---" are syntax. */
export function wordCount(body: string): number {
  const text = body
    .split(/\r?\n/)
    .filter((line) => !FENCE_LINE.test(line))
    .join("\n")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\](?=\s))?/gm, "");
  return (text.match(/\S+/g) ?? []).filter((t) => /[\p{L}\p{N}]/u.test(t))
    .length;
}

/** Lines of a code note's text, not counting the fences or blank lines. */
export function lineCount(body: string): number {
  return body
    .split(/\r?\n/)
    .filter((line) => line.trim() && !FENCE_LINE.test(line)).length;
}
