// src/hooks/useMarkdownFormat.ts
import { useCallback } from "react";
import type { RefObject } from "react";

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

export function useMarkdownFormat(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (v: string) => void,
): (type: FormatType) => void {
  return useCallback(
    (type: FormatType) => {
      const el = textareaRef.current;
      if (!el) return;

      const ss = el.selectionStart;
      const se = el.selectionEnd;
      const selected = value.slice(ss, se);

      let newVal = value;
      let newSS = ss;
      let newSE = se;

      const inlineWrap = (marker: string) => {
        if (selected) {
          const wrapped = `${marker}${selected}${marker}`;
          newVal = value.slice(0, ss) + wrapped + value.slice(se);
          newSS = ss;
          newSE = ss + wrapped.length;
        } else {
          const insert = `${marker}${marker}`;
          newVal = value.slice(0, ss) + insert + value.slice(se);
          newSS = ss + marker.length;
          newSE = ss + marker.length;
        }
      };

      const linePrefix = (prefix: string) => {
        const lineStart = value.lastIndexOf("\n", ss - 1) + 1;
        // Don't include a trailing newline that sits exactly at the selection end
        const adjustedSe = se > ss && value[se - 1] === "\n" ? se - 1 : se;
        const eolIdx = value.indexOf("\n", adjustedSe);
        const lineEnd = eolIdx === -1 ? value.length : eolIdx;

        const region = value.slice(lineStart, lineEnd);
        const lines = region.split("\n");
        const allHavePrefix = lines.every((line) => line.startsWith(prefix));

        const newLines = allHavePrefix
          ? lines.map((line) => line.slice(prefix.length))
          : lines.map((line) => `${prefix}${line}`);

        const newRegion = newLines.join("\n");
        newVal = value.slice(0, lineStart) + newRegion + value.slice(lineEnd);

        const prefixDelta = allHavePrefix ? -prefix.length : prefix.length;
        newSS = Math.max(lineStart, ss + prefixDelta);
        newSE = Math.max(newSS, se + lines.length * prefixDelta);
      };

      switch (type) {
        case "bold":
          inlineWrap("**");
          break;
        case "italic":
          inlineWrap("*");
          break;
        case "strikethrough":
          inlineWrap("~~");
          break;
        case "code":
          inlineWrap("`");
          break;
        case "h1":
          linePrefix("# ");
          break;
        case "h2":
          linePrefix("## ");
          break;
        case "h3":
          linePrefix("### ");
          break;
        case "ul":
          linePrefix("- ");
          break;
        case "ol":
          linePrefix("1. ");
          break;
        case "blockquote":
          linePrefix("> ");
          break;
        case "codeblock": {
          const insert = "```\n\n```";
          newVal = value.slice(0, ss) + insert + value.slice(se);
          // Park cursor between the fences (after "```\n")
          newSS = ss + 4;
          newSE = ss + 4;
          break;
        }
        case "hr": {
          const insert = "\n---\n";
          newVal = value.slice(0, ss) + insert + value.slice(se);
          newSS = ss + insert.length;
          newSE = ss + insert.length;
          break;
        }
        case "link": {
          if (selected) {
            const insert = `[${selected}](url)`;
            newVal = value.slice(0, ss) + insert + value.slice(se);
            // Select "url" so user can replace it immediately
            newSS = ss + 1 + selected.length + 2;
            newSE = newSS + 3;
          } else {
            const insert = "[text](url)";
            newVal = value.slice(0, ss) + insert + value.slice(se);
            // Select "text" so user can replace it immediately
            newSS = ss + 1;
            newSE = ss + 5;
          }
          break;
        }
        default:
          break;
      }

      onChange(newVal);
      requestAnimationFrame(() => {
        el.setSelectionRange(newSS, newSE);
        el.focus();
      });
    },
    [textareaRef, value, onChange],
  );
}
