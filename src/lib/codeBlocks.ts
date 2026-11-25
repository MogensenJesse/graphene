// src/lib/codeBlocks.ts

/** A fenced code block, with where the language tag sits on its opening fence line. */
interface FencedBlock {
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
 * It runs on every keystroke of the editor, so it never splits the text into lines: only a line that starts with a
 * fence can open or close a block, and the scan jumps from one such line to the next. It stops at the caret's line,
 * because nothing after it can change the answer. Whether the caret is inside a block still depends on every fence
 * before it (a bare fence closes a block and opens one), so those are all read.
 */
export function findFenceAt(text: string, caret: number): FencedBlock | null {
  let open: {
    char: string;
    len: number;
    start: number;
    block: FencedBlock;
  } | null = null;
  const run = /`{3,}|~{3,}/g; // a run of fence characters, from wherever the last one left off

  for (let hit = run.exec(text); hit; hit = run.exec(text)) {
    // A fence line starts with the run, after at most 3 spaces
    let offset = hit.index;
    for (let k = 0; k < 3 && text[offset - 1] === " "; k++) offset--;
    if (offset > 0 && text[offset - 1] !== "\n") continue;
    if (offset > caret) break; // the caret's line is behind us
    const eol = text.indexOf("\n", hit.index);
    const lineEnd = eol === -1 ? text.length : eol;
    const line = text.slice(offset, lineEnd);
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
    run.lastIndex = lineEnd + 1;
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

/** The code between the first opening fence and its closing fence ("" when the text has no block). */
export function firstCodeBlock(text: string): string {
  let open: { char: string; len: number } | null = null;
  const code: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (!open) {
      const m = OPENING_FENCE.exec(line);
      if (m) open = { char: m[2][0], len: m[2].length };
    } else {
      const m = CLOSING_FENCE.exec(line);
      if (m && m[1][0] === open.char && m[1].length >= open.len) break;
      code.push(line);
    }
  }
  return code.join("\n");
}
