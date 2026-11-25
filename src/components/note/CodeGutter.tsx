// src/components/note/CodeGutter.tsx
import { memo, type RefObject, useLayoutEffect, useRef } from "react";

interface CodeGutterProps {
  /** The note's text, "\n" line endings */
  text: string;
  /** What `gutterNumbers` made of `text`: the number of each line, null where there is none */
  numbers: (number | null)[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * The line numbers beside the code in the editor. They sit over the textarea, in a copy of its text drawn in no colour:
 * the browser wraps that copy exactly as it wraps the textarea (same width, font, padding, wrap), so a number lands on the
 * first row of its line however long the line is, and nothing here measures. Only the numbers show. It does not take the
 * pointer, and it follows the textarea's scroll.
 */
function CodeGutter({ text, numbers, textareaRef }: CodeGutterProps) {
  const gutterRef = useRef<HTMLDivElement>(null);

  // A new text can change how far the textarea scrolls, so the copy is lined up again after it renders
  // biome-ignore lint/correctness/useExhaustiveDependencies: text is the trigger
  useLayoutEffect(() => {
    const area = textareaRef.current;
    const gutter = gutterRef.current;
    if (!area || !gutter) return;
    const follow = () => {
      gutter.scrollTop = area.scrollTop;
    };
    follow();
    area.addEventListener("scroll", follow, { passive: true });
    return () => area.removeEventListener("scroll", follow);
  }, [textareaRef, text]);

  return (
    <div ref={gutterRef} className="note-editor__gutter" aria-hidden="true">
      {text.split("\n").map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a line has no identity apart from its place
        <div key={i} data-n={numbers[i] ?? undefined}>
          {line}
        </div>
      ))}
    </div>
  );
}

export default memo(CodeGutter);
