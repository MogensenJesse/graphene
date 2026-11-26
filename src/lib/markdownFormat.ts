// src/lib/markdownFormat.ts

export type FormatType =
  | "h1"
  | "h2"
  | "h3"
  | "bold"
  | "italic"
  | "strikethrough"
  | "code"
  | "ul"
  | "ol"
  | "task"
  | "blockquote"
  | "codeblock"
  | "hr"
  | "link"
  | "indent"
  | "outdent";

/** New text plus where the selection sits in it. */
export interface TextEdit {
  value: string;
  ss: number;
  se: number;
}

const INLINE_MARKER: Partial<Record<FormatType, string>> = {
  bold: "**",
  italic: "*",
  strikethrough: "~~",
  code: "`",
};

const HEADING = /^#{1,6} /;

// has = the prefix this format adds (so a second press takes it off);
// strip = what goes before a new prefix goes on (a heading replaces any other heading level)
const LINE_FORMAT: Partial<
  Record<
    FormatType,
    { has: RegExp; prefix: (i: number) => string; strip?: RegExp }
  >
> = {
  // A task line is not a plain bullet, so its button stays off and a press turns it into one
  ul: {
    has: /^- (?!\[[ xX]\] )/,
    prefix: () => "- ",
    strip: /^- (\[[ xX]\] )?/,
  },
  ol: { has: /^\d+\. /, prefix: (i) => `${i + 1}. ` },
  task: {
    has: /^- \[[ xX]\] /,
    prefix: () => "- [ ] ",
    strip: /^- (\[[ xX]\] )?/,
  },
  blockquote: { has: /^> /, prefix: () => "> " },
  h1: { has: /^# /, prefix: () => "# ", strip: HEADING },
  h2: { has: /^## /, prefix: () => "## ", strip: HEADING },
  h3: { has: /^### /, prefix: () => "### ", strip: HEADING },
};

// One span per match on a line, markers included. Opening marker followed by a non-space and the
// closing one preceded by one, as toggleInline writes them. A single "*" never matches half of "**".
// ponytail: "***x***" (bold and italic together) reads as bold only, so italic wraps it once more
const INLINE_SPAN: Record<string, RegExp> = {
  "**": /\*\*(?=\S)(.+?)(?<=\S)\*\*/g,
  "*": /(?<!\*)\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?!\*)/g,
  "~~": /~~(?=\S)(.+?)(?<=\S)~~/g,
  "`": /`[^`\n]+`/g,
};

/** The selection without the spaces at its ends ("** x **" is not bold, so spaces stay outside). */
function trimSelection(
  value: string,
  ss: number,
  se: number,
): [number, number] {
  const picked = value.slice(ss, se);
  if (!picked.trim()) return [ss, se];
  return [
    ss + picked.length - picked.trimStart().length,
    se - (picked.length - picked.trimEnd().length),
  ];
}

/**
 * The `marker` span on the selection's line that the selection sits in: in its text or on the
 * whole span, markers included (so a caret outside the markers does not count). [start, end) with
 * the markers, or null.
 */
function enclosingSpan(
  value: string,
  ss: number,
  se: number,
  marker: string,
): [number, number] | null {
  const n = marker.length;
  // An empty pair with the caret between it ("**|**"), which the regexes need text to match
  if (
    ss === se &&
    ss >= n &&
    value.slice(ss - n, ss) === marker &&
    value.slice(se, se + n) === marker &&
    !(marker === "*" && (value[ss - n - 1] === "*" || value[se + n] === "*"))
  )
    return [ss - n, se + n];

  const lineStart = ss === 0 ? 0 : value.lastIndexOf("\n", ss - 1) + 1;
  const eol = value.indexOf("\n", lineStart);
  const lineEnd = eol === -1 ? value.length : eol;
  if (se > lineEnd) return null;
  for (const m of value
    .slice(lineStart, lineEnd)
    .matchAll(INLINE_SPAN[marker])) {
    const start = lineStart + m.index;
    const end = start + m[0].length;
    const inText = ss >= start + n && se <= end - n;
    if (inText || (ss <= start && se >= end)) return [start, end];
  }
  return null;
}

function toggleInline(
  value: string,
  ss: number,
  se: number,
  marker: string,
): TextEdit {
  [ss, se] = trimSelection(value, ss, se);
  const n = marker.length;

  // Already in a span: take its markers off and keep the text selected
  const span = enclosingSpan(value, ss, se, marker);
  if (span) {
    const [start, end] = span;
    // Where a position lands once the markers are gone
    const shift = (p: number) =>
      p <= start
        ? p
        : p < start + n
          ? start
          : p <= end - n
            ? p - n
            : p < end
              ? end - 2 * n
              : p - 2 * n;
    return {
      value:
        value.slice(0, start) +
        value.slice(start + n, end - n) +
        value.slice(end),
      ss: shift(ss),
      se: shift(se),
    };
  }
  return {
    value: `${value.slice(0, ss)}${marker}${value.slice(ss, se)}${marker}${value.slice(se)}`,
    ss: ss + n,
    se: se + n,
  };
}

/** The lines a line format works on. Blank ones are left alone, unless every line is blank (an empty line is where a list starts). */
function lineRegion(value: string, ss: number, se: number) {
  const lineStart = ss === 0 ? 0 : value.lastIndexOf("\n", ss - 1) + 1;
  // A newline right at the end of the selection (triple-click) belongs to the last line, not the next
  const end = se > ss && value[se - 1] === "\n" ? se - 1 : se;
  const eol = value.indexOf("\n", end);
  const lineEnd = eol === -1 ? value.length : eol;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const skipBlank = lines.some((line) => line.trim());
  const targeted = (line: string) => !skipBlank || line.trim() !== "";
  return { lineStart, lineEnd, lines, targeted };
}

function toggleLines(
  value: string,
  ss: number,
  se: number,
  format: NonNullable<(typeof LINE_FORMAT)[FormatType]>,
): TextEdit {
  const { lineStart, lineEnd, lines, targeted } = lineRegion(value, ss, se);
  const off = lines.filter(targeted).every((line) => format.has.test(line));

  let i = 0;
  const out = lines.map((line) => {
    if (!targeted(line)) return line;
    const bare = line.replace(format.strip ?? format.has, "");
    return off ? bare : format.prefix(i++) + bare;
  });
  const region = out.join("\n");
  const next = value.slice(0, lineStart) + region + value.slice(lineEnd);

  // A caret stays on its text; a selection grows to cover its lines, so pressing again undoes it
  if (ss === se) {
    const caret = Math.max(lineStart, ss + out[0].length - lines[0].length);
    return { value: next, ss: caret, se: caret };
  }
  return { value: next, ss: lineStart, se: lineStart + region.length };
}

function wrapInFence(value: string, ss: number, se: number): TextEdit {
  if (se > ss && value[se - 1] === "\n") se--; // triple-click: no blank line before the closing fence
  const picked = value.slice(ss, se);
  // Fences must sit on lines of their own
  const before = ss > 0 && value[ss - 1] !== "\n" ? "\n" : "";
  const after = se < value.length && value[se] !== "\n" ? "\n" : "";
  const afterOpening = ss + before.length + 3;
  // Wrapped text: caret right after the opening fence so a language can be typed.
  // Empty block: caret inside it.
  const caret = picked ? afterOpening : afterOpening + 1;
  return {
    value: `${value.slice(0, ss)}${before}\`\`\`\n${picked}\n\`\`\`${after}${value.slice(se)}`,
    ss: caret,
    se: caret,
  };
}

// The start of a list item: indent, marker (a bullet, or a number with "." or ")"), the gap after it, and a task's checkbox
const LIST_ITEM = /^([ \t]*)([*+-]|\d{1,9}[.)])([ \t]+)(\[[ xX]\][ \t]*)?/;
// "* * *" and "- - -" are a horizontal rule, not a bullet
const THEMATIC_BREAK = /^[ \t]*([*-])([ \t]*\1){2,}[ \t]*$/;

const listItemAt = (line: string): RegExpExecArray | null =>
  THEMATIC_BREAK.test(line) ? null : LIST_ITEM.exec(line);

/**
 * What Enter does on a list line (a bullet, a number, a task): a new item below it, at the same indent, numbered one
 * higher in a numbered list and with an unticked box for a task (the text after the caret moves down with it); on an
 * empty item, it clears the line instead, which ends the list. Null when the caret is not at the text of an item, so
 * Enter keeps its normal meaning.
 */
export function continueList(
  value: string,
  ss: number,
  se: number,
): TextEdit | null {
  if (ss !== se) return null;
  const lineStart = ss === 0 ? 0 : value.lastIndexOf("\n", ss - 1) + 1;
  const eol = value.indexOf("\n", ss);
  const lineEnd = eol === -1 ? value.length : eol;
  const line = value.slice(lineStart, lineEnd);
  const m = listItemAt(line);
  if (!m || ss - lineStart < m[0].length) return null;

  if (!line.slice(m[0].length).trim()) {
    return {
      value: value.slice(0, lineStart) + value.slice(lineEnd),
      ss: lineStart,
      se: lineStart,
    };
  }
  const n = /^\d+/.exec(m[2]);
  const marker = n ? `${Number(n[0]) + 1}${m[2].slice(n[0].length)}` : m[2];
  const insert = `\n${m[1]}${marker}${m[3]}${m[4] ? "[ ] " : ""}`;
  const caret = ss + insert.length;
  return {
    value: value.slice(0, ss) + insert + value.slice(ss),
    ss: caret,
    se: caret,
  };
}

/**
 * What Tab and Shift+Tab do on a list line (a bullet, a number, a task): the whole line moves in or out one level (a
 * sub-item), the caret keeps its place in the text. A level is 2 spaces for a bullet and the marker's width plus one
 * for a number, since CommonMark nests under `1. a` only from 3 spaces. Null when the selection is not within one
 * list line, so Tab keeps its normal meaning.
 */
export function shiftListIndent(
  value: string,
  ss: number,
  se: number,
  outdent: boolean,
): TextEdit | null {
  const lineStart = ss === 0 ? 0 : value.lastIndexOf("\n", ss - 1) + 1;
  const eol = value.indexOf("\n", ss);
  const lineEnd = eol === -1 ? value.length : eol;
  if (se > lineEnd) return null;
  const line = value.slice(lineStart, lineEnd);
  const m = listItemAt(line);
  if (!m) return null;
  const step = /^\d/.test(m[2]) ? m[2].length + 1 : 2;
  const out = outdent ? Math.min(step, m[1].length) : 0;
  if (outdent && out === 0) return null;
  const rest = outdent ? value.slice(lineStart + out) : value.slice(lineStart);
  const delta = outdent ? -out : step;
  return {
    value: value.slice(0, lineStart) + (outdent ? "" : " ".repeat(step)) + rest,
    ss: Math.max(lineStart, ss + delta),
    se: Math.max(lineStart, se + delta),
  };
}

/**
 * The toggle formats that are on at the selection ss..se, i.e. the ones a press of their button
 * would take off: inline ones when the selection sits in their span, line ones when every line
 * of the selection has the prefix. Same rules as formatText, so the two always agree.
 */
export function activeFormats(
  value: string,
  ss: number,
  se: number,
): Set<FormatType> {
  const on = new Set<FormatType>();
  [ss, se] = trimSelection(value, ss, se);
  for (const type of Object.keys(INLINE_MARKER) as FormatType[]) {
    const marker = INLINE_MARKER[type];
    if (marker && enclosingSpan(value, ss, se, marker)) on.add(type);
  }
  const { lines, targeted } = lineRegion(value, ss, se);
  for (const type of Object.keys(LINE_FORMAT) as FormatType[]) {
    const format = LINE_FORMAT[type];
    if (format && lines.filter(targeted).every((line) => format.has.test(line)))
      on.add(type);
  }
  return on;
}

/**
 * Applies a toolbar format to `value` with the selection ss..se. Inline formats and line prefixes
 * toggle off when pressed again; code block wraps the selection in a fence.
 */
export function formatText(
  value: string,
  ss: number,
  se: number,
  type: FormatType,
): TextEdit {
  const marker = INLINE_MARKER[type];
  if (marker) return toggleInline(value, ss, se, marker);
  const lineFormat = LINE_FORMAT[type];
  if (lineFormat) return toggleLines(value, ss, se, lineFormat);

  switch (type) {
    case "codeblock":
      return wrapInFence(value, ss, se);
    case "indent":
    case "outdent": {
      // The Tab key's work, for a screen with no Tab key: a list line moves in or out; indent anywhere else writes two spaces
      const moved = shiftListIndent(value, ss, se, type === "outdent");
      if (moved) return moved;
      if (type === "outdent") return { value, ss, se };
      return {
        value: `${value.slice(0, ss)}  ${value.slice(se)}`,
        ss: ss + 2,
        se: ss + 2,
      };
    }
    case "hr": {
      // Text directly above "---" would turn into a heading, so keep a blank line between
      const head = value.slice(0, se);
      const lead =
        !head || head.endsWith("\n\n")
          ? ""
          : head.endsWith("\n")
            ? "\n"
            : "\n\n";
      const insert = `${lead}---\n\n`;
      const caret = se + insert.length;
      return {
        value: head + insert + value.slice(se),
        ss: caret,
        se: caret,
      };
    }
    case "link": {
      const picked = value.slice(ss, se);
      if (picked) {
        // Select "url" so it can be replaced straight away
        const urlStart = ss + 1 + picked.length + 2;
        return {
          value: `${value.slice(0, ss)}[${picked}](url)${value.slice(se)}`,
          ss: urlStart,
          se: urlStart + 3,
        };
      }
      // Select "text" so it can be replaced straight away
      return {
        value: `${value.slice(0, ss)}[text](url)${value.slice(se)}`,
        ss: ss + 1,
        se: ss + 5,
      };
    }
    default:
      return { value, ss, se };
  }
}
