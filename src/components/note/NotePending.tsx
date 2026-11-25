// src/components/note/NotePending.tsx
import { useEffect, useState } from "react";
import Button from "../ui/Button";

interface NotePendingProps {
  id: string;
  /** Reads the text of the note (useItems `loadBodies`); the app swaps this panel for the note once it is in. */
  load: (ids: string[]) => Promise<void>;
}

/**
 * Stands in for a note whose text has not been read yet (the sidebar lists notes before their texts are in). It asks for that one
 * note at once, ahead of the background load, so it is usually gone before it is seen: the word fades in after a moment. Opening
 * or editing the note waits for this, so the editor never starts on the empty text of a note that is merely not loaded.
 */
function NotePending({ id, load }: NotePendingProps) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is the "try again" trigger
  useEffect(() => {
    let stale = false;
    setFailed(false);
    load([id]).catch((err) => {
      console.error("[NotePending]", err);
      if (!stale) setFailed(true);
    });
    return () => {
      stale = true;
    };
  }, [id, load, attempt]);

  return failed ? (
    <div className="pane-pending" role="alert">
      <span>This note could not be read.</span>
      <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
        Try again
      </Button>
    </div>
  ) : (
    <p className="pane-pending" role="status">
      Loading…
    </p>
  );
}

export default NotePending;
