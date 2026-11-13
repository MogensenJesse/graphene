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
  | "blockquote"
  | "codeblock"
  | "hr"
  | "link";

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
  ul: { has: /^- /, prefix: () => "- " },
  ol: { has: /^\d+\. /, prefix: (i) => `${i + 1}. ` },
  blockquote: { has: /^> /, prefix: () => "> " },
  h1: { has: /^# /, prefix: () => "# ", strip: HEADING },
  h2: { has: /^## /, prefix: () => "## ", strip: HEADING },
  h3: { has: /^### /, prefix: () => "### ", strip: HEADING },
};

// ponytail: "***x***" (bold and italic together) counts as bold, so italic wraps it once more
function toggleInline(
  value: string,
  ss: number,
  se: number,
  marker: string,
): TextEdit {
  // Spaces inside the markers break them ("** x **" is not bold), so keep them outside
  const picked = value.slice(ss, se);
  if (picked.trim()) {
    ss += picked.length - picked.trimStart().length;
    se -= picked.length - picked.trimEnd().length;
  }
  const n = marker.length;
  const inner = value.slice(ss, se);
  const half = marker === "*"; // one "*" must not match half of a "**"

  // Markers just outside the selection: take them off, keep the text selected
  if (
    value.slice(ss - n, ss) === marker &&
    value.slice(se, se + n) === marker &&
    !(half && (value[ss - n - 1] === "*" || value[se + n] === "*"))
  ) {
    return {
      value: value.slice(0, ss - n) + inner + value.slice(se + n),
      ss: ss - n,
      se: se - n,
    };
  }
  // Markers inside the selection
  if (
    inner.length >= 2 * n &&
    inner.startsWith(marker) &&
    inner.endsWith(marker) &&
    !(half && inner.startsWith("**"))
  ) {
    const bare = inner.slice(n, -n);
    return {
      value: value.slice(0, ss) + bare + value.slice(se),
      ss,
      se: ss + bare.length,
    };
  }
  return {
    value: `${value.slice(0, ss)}${marker}${inner}${marker}${value.slice(se)}`,
    ss: ss + n,
    se: se + n,
  };
}

function toggleLines(
  value: string,
  ss: number,
  se: number,
  format: NonNullable<(typeof LINE_FORMAT)[FormatType]>,
): TextEdit {
  const lineStart = ss === 0 ? 0 : value.lastIndexOf("\n", ss - 1) + 1;
  // A newline right at the end of the selection (triple-click) belongs to the last line, not the next
  const end = se > ss && value[se - 1] === "\n" ? se - 1 : se;
  const eol = value.indexOf("\n", end);
  const lineEnd = eol === -1 ? value.length : eol;

  const lines = value.slice(lineStart, lineEnd).split("\n");
  // Blank lines stay blank, unless every line is blank (an empty line is where a list starts)
  const skipBlank = lines.some((line) => line.trim());
  const targeted = (line: string) => !skipBlank || line.trim() !== "";
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
