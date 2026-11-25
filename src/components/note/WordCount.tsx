// src/components/note/WordCount.tsx
import { useMemo } from "react";
import { formatDate, isCodeBody } from "../../lib/utils";
import { lineCount, wordCount } from "../../lib/wordCount";
import Tooltip from "../ui/Tooltip";

interface WordCountProps {
  // The editor passes a debounced copy of the text (see NoteEditor), so counting a big note never waits on a keystroke
  body: string;
  // When the note was last edited; left out for a draft that is not saved yet
  updatedAt?: string;
}

/** The status line under a note: "Edited today · 5 words", or lines for a code note. */
function WordCount({ body, updatedAt }: WordCountProps) {
  // Once per text, not on every render of the parent
  const { code, n } = useMemo(() => {
    const code = isCodeBody(body);
    return { code, n: code ? lineCount(body) : wordCount(body) };
  }, [body]);
  return (
    <div className="word-count">
      {updatedAt && (
        <>
          <Tooltip label={new Date(updatedAt).toLocaleString()}>
            <span>Edited {formatDate(updatedAt)}</span>
          </Tooltip>
          {" · "}
        </>
      )}
      {n} {code ? "line" : "word"}
      {n === 1 ? "" : "s"}
    </div>
  );
}

export default WordCount;
