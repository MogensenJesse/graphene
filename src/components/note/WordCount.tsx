// src/components/note/WordCount.tsx
import { formatDate, isCodeBody, lineCount, wordCount } from "../../lib/utils";
import Tooltip from "../ui/Tooltip";

interface WordCountProps {
  body: string;
  // When the note was last edited; left out for a draft that is not saved yet
  updatedAt?: string;
}

/** The status line under a note: "Edited today · 5 words", or lines for a code note. */
function WordCount({ body, updatedAt }: WordCountProps) {
  const code = isCodeBody(body);
  const n = code ? lineCount(body) : wordCount(body);
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
