// src/components/note/WordCount.tsx
import { wordCount } from "../../lib/utils";

/** A small muted "123 words" line under a note's text, in the editor and the read view. */
function WordCount({ body }: { body: string }) {
  const n = wordCount(body);
  return (
    <div className="word-count">
      {n} {n === 1 ? "word" : "words"}
    </div>
  );
}

export default WordCount;
