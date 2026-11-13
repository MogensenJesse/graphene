// src/hooks/useMarkdownFormat.ts

import type { RefObject } from "react";
import { useCallback } from "react";
import {
  type FormatType,
  formatText,
  type TextEdit,
} from "../lib/markdownFormat";

/**
 * Puts `next` into the textarea as one typed-in edit. Assigning `el.value` (what a controlled
 * textarea does on setState) wipes the browser's undo history; execCommand keeps it, so Ctrl+Z and
 * Ctrl+Shift+Z also walk back through formatting. Only the part that changed is replaced.
 * execCommand is deprecated but is the only way to edit without losing undo.
 */
export function replaceText(el: HTMLTextAreaElement, next: TextEdit): void {
  const old = el.value;
  const max = Math.min(old.length, next.value.length);
  let head = 0;
  while (head < max && old[head] === next.value[head]) head++;
  let tail = 0;
  while (
    tail < max - head &&
    old[old.length - 1 - tail] === next.value[next.value.length - 1 - tail]
  )
    tail++;

  const oldEnd = old.length - tail;
  const inserted = next.value.slice(head, next.value.length - tail);
  el.focus();
  if (head < oldEnd || inserted) {
    el.setSelectionRange(head, oldEnd);
    // "delete" on an empty range would remove the character before it, hence the check above
    if (inserted) document.execCommand("insertText", false, inserted);
    else document.execCommand("delete");
  }
  el.setSelectionRange(next.ss, next.se);
}

export function useMarkdownFormat(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
): (type: FormatType) => void {
  return useCallback(
    (type: FormatType) => {
      const el = textareaRef.current;
      if (!el) return;
      // el.value, not the React state: the textarea has "\n" where a loaded file may have "\r\n"
      replaceText(
        el,
        formatText(el.value, el.selectionStart, el.selectionEnd, type),
      );
    },
    [textareaRef],
  );
}
