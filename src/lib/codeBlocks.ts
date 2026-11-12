// src/lib/codeBlocks.ts

/** A fenced code block, with where the language tag sits on its opening fence line. */
export interface FencedBlock {
  lang: string; // current tag, "" when there is none
  langStart: number; // offset where the tag starts (or would start)
  langEnd: number;
}

// "```js" or "~~~ js title=x": indent, fence, optional spaces, then the tag word
const OPENING_FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^\s`]*)/;
const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})\s*$/;

/**
 * The fenced block that contains `caret` (opening fence line through closing fence line), or null.
 * `text` must use "\n" line endings, like a textarea value.
 */
export function findFenceAt(text: string, caret: number): FencedBlock | null {
  let open: {
    char: string;
    len: number;
    start: number;
    block: FencedBlock;
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

  // An unclosed fence runs to the end of the text
  return open && caret >= open.start ? open.block : null;
}

/** `text` with the block's language tag replaced ("" removes it). */
export function setFenceLang(
  text: string,
  block: FencedBlock,
  lang: string,
): string {
  return text.slice(0, block.langStart) + lang + text.slice(block.langEnd);
}
