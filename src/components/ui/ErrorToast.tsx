// src/components/ui/ErrorToast.tsx
import { useEffect, useState } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { type AppError, onError } from "../../lib/reportError";
import Button from "./Button";

// Long enough to read a sentence and reach for Retry
const SHOW_MS = 10000;
// A notice is read, not acted on
const NOTICE_MS = 6000;
// How long it takes to fade out: the toast-out animation in _Toast.scss
const LEAVE_MS = 150;

/** What went wrong with a write, with Retry when the failed write can be run again. App mounts one; the newest error replaces the one showing. */
function ErrorToast() {
  const [error, setError] = useState<AppError | null>(null);
  const [leaving, setLeaving] = useState(false);
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(
    () =>
      onError((next) => {
        setLeaving(false);
        setError(next);
      }),
    [],
  );

  // Each error gets its own time on screen
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(
      () => setLeaving(true),
      error.notice ? NOTICE_MS : SHOW_MS,
    );
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setError(null), still ? 0 : LEAVE_MS);
    return () => clearTimeout(t);
  }, [leaving, still]);

  if (!error) return null;
  const { retry } = error;

  return (
    <div
      key={error.id}
      className={`toast toast--${error.notice ? "notice" : "error"}${leaving ? " toast--leaving" : ""}`}
      role={error.notice ? "status" : "alert"}
    >
      <span className="toast__text">{error.message}</span>
      {retry && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setLeaving(true);
            Promise.resolve().then(retry).catch(console.error);
          }}
        >
          Retry
        </Button>
      )}
      <Button size="sm" onClick={() => setLeaving(true)}>
        Dismiss
      </Button>
    </div>
  );
}

export default ErrorToast;
