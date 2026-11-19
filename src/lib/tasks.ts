// src/lib/tasks.ts

// A list item that is a task: "- [ ]", "* [x]", "1. [ ]"
const TASK_MARKER = /^(?:[*+-]|\d{1,9}[.)])[ \t]+\[([ xX])\]/;
const TASK_LINE = /^[ \t]*(?:[*+-]|\d{1,9}[.)])[ \t]+\[([ xX])\](?:\s|$)/;
const HEADING_LINE = /^\s{0,3}#{1,6}(?:\s|$)/;
const FENCE_LINE = /^\s{0,3}(`{3,}|~{3,})/;

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

/** The lines of `body`, one at a time (a line keeps a trailing "\r"). */
function* eachLine(body: string): Generator<string> {
  let start = 0;
  while (start <= body.length) {
    const nl = body.indexOf("\n", start);
    yield body.slice(start, nl === -1 ? undefined : nl);
    if (nl === -1) return;
    start = nl + 1;
  }
}

/** The lines outside fenced code blocks (the fence lines themselves are left out too), with their 1-based number. */
function* textLines(body: string): Generator<[line: string, no: number]> {
  let fence: string | null = null;
  let no = 0;
  for (const line of eachLine(body)) {
    no++;
    const f = FENCE_LINE.exec(line)?.[1];
    if (f && fence === null) fence = f[0];
    else if (f && f[0] === fence) fence = null;
    else if (fence === null) yield [line, no];
  }
}

/** How many tasks a note has and how many are ticked. ponytail: tasks inside a blockquote are not counted. */
export function taskProgress(body: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const [line] of textLines(body)) {
    const m = TASK_LINE.exec(line);
    if (!m) continue;
    total++;
    if (m[1] !== " ") done++;
  }
  return { done, total };
}

export interface TaskInfo {
  /** The 1-based line of the task in the note: how `setTaskDone` finds it again. */
  line: number;
  done: boolean;
  /** The task's text without its list marker and checkbox; a due token stays in it. */
  text: string;
  /** The date of a "due:YYYY-MM-DD" in the text, or null. */
  due: string | null;
}

/** Every task of a note, outside code fences. ponytail: like taskProgress, a task inside a blockquote is not seen. */
export function listTasks(body: string): TaskInfo[] {
  const tasks: TaskInfo[] = [];
  for (const [line, no] of textLines(body)) {
    const m = TASK_LINE.exec(line);
    if (!m) continue;
    const text = line
      .replace(/^[ \t]*(?:[*+-]|\d{1,9}[.)])[ \t]+\[[ xX]\][ \t]*/, "")
      .replace(/\r$/, "");
    tasks.push({
      line: no,
      done: m[1] !== " ",
      text,
      due: /\bdue:(\d{4}-\d{2}-\d{2})\b/.exec(text)?.[1] ?? null,
    });
  }
  return tasks;
}

/** Ticks or unticks the task on `line` (as `listTasks` numbers it). Null when that line is not a task. */
export function setTaskDone(
  body: string,
  line: number,
  done: boolean,
): string | null {
  const task = listTasks(body).find((t) => t.line === line);
  if (!task) return null;
  if (task.done === done) return body;
  const lines = body.split("\n");
  const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
  return toggleTaskAt(body, start + indentOf(lines[line - 1]));
}

/** A to-do note: the first line that is not blank or a heading is a task. */
export function isTodoBody(body: string): boolean {
  for (const line of eachLine(body)) {
    if (!line.trim() || HEADING_LINE.test(line)) continue;
    return TASK_LINE.test(line);
  }
  return false;
}

// ── Due dates ("due:2026-12-01", the todo.txt form) ───────────────────────────

/** Splits text around its due tokens; the tokens are the odd entries. */
export const DUE_SPLIT = /(\bdue:\d{4}-\d{2}-\d{2}\b)/;

/** Today as YYYY-MM-DD in local time. */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dueStatus(
  date: string,
  today = localDate(),
): "overdue" | "today" | "later" {
  return date < today ? "overdue" : date === today ? "today" : "later";
}

// ── Reordering ────────────────────────────────────────────────────────────────

const indentOf = (line: string) => /^[ \t]*/.exec(line)?.[0].length ?? 0;

/** The lines [start, end) of the task on line i: itself and the lines under it that are indented deeper. */
function taskBlock(lines: string[], i: number): [number, number] {
  const indent = indentOf(lines[i]);
  let end = i + 1;
  while (
    end < lines.length &&
    lines[end].trim() &&
    indentOf(lines[end]) > indent
  )
    end++;
  return [i, end];
}

/** The line index an offset sits on, or -1 when the offset is not at a task marker. */
function taskLineAt(lines: string[], offset: number): number {
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const end = start + lines[i].length;
    if (offset >= start && offset <= end) {
      const indent = indentOf(lines[i]);
      return offset - start === indent && TASK_LINE.test(lines[i]) ? i : -1;
    }
    start = end + 1;
  }
  return -1;
}

/**
 * Moves the task at `fromOffset` (with the lines indented under it) before or after the task at
 * `toOffset`, indenting it to its new neighbour's level. Null when either offset is not a task,
 * the target is inside the moved block, or nothing would change.
 * ponytail: a blank line ends a block, so sub-items split from their parent by a blank line stay behind.
 */
export function moveTask(
  body: string,
  fromOffset: number,
  toOffset: number,
  after: boolean,
): string | null {
  const lines = body.split("\n");
  const from = taskLineAt(lines, fromOffset);
  const to = taskLineAt(lines, toOffset);
  if (from < 0 || to < 0) return null;

  const [fs, fe] = taskBlock(lines, from);
  if (to >= fs && to < fe) return null;
  const [ts, te] = taskBlock(lines, to);
  const at = after ? te : ts;
  if (at === fs || at === fe) return null;

  const shift = indentOf(lines[to]) - indentOf(lines[from]);
  const moved = lines
    .slice(fs, fe)
    .map((l) =>
      shift >= 0
        ? " ".repeat(shift) + l
        : l.replace(new RegExp(`^[ \\t]{0,${-shift}}`), ""),
    );
  const rest = [...lines.slice(0, fs), ...lines.slice(fe)];
  const insertAt = at > fs ? at - (fe - fs) : at;
  rest.splice(insertAt, 0, ...moved);
  return rest.join("\n");
}
