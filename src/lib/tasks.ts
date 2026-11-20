// src/lib/tasks.ts

// A list item that is a task: "- [ ]", "* [x]", "1. [ ]"
const TASK_MARKER = /^(?:[*+-]|\d{1,9}[.)])[ \t]+\[([ xX])\]/;

/**
 * Flips the checkbox of the task whose list marker starts at `offset` in `body` (the offset the
 * markdown parser reports). Null when nothing there is a task, e.g. the text changed since the
 * page was drawn. An offset, not "the Nth checkbox", so a "- [ ]" inside a code fence is never hit.
 */
export function toggleTaskAt(body: string, offset: number): string | null {
  const m = TASK_MARKER.exec(body.slice(offset));
  if (!m) return null;
  const at = offset + m[0].length - 2; // the character between the brackets
  return body.slice(0, at) + (m[1] === " " ? "x" : " ") + body.slice(at + 1);
}
