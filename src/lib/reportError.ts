// src/lib/reportError.ts
// The one channel for failures the user has to see (a write that did not reach the disk).
// Any code may call reportError; App mounts the single listener that shows the toast.

export type AppError = {
  id: number;
  /** Plain language, what did not happen: `Could not save "Title"`. */
  message: string;
  /** Runs the failed write again. The toast offers Retry only when this is set. */
  retry?: () => void | Promise<void>;
  /** Not a failure: a plain note for the user (the vault that was opened instead, where a restored note went). */
  notice?: boolean;
};

type Listener = (error: AppError) => void;

const listeners = new Set<Listener>();
let nextId = 1;

/** Subscribe to reported errors; returns the unsubscribe function. */
export function onError(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tells the user and still logs, so the console keeps what it had. Never throws. */
export function reportError(
  message: string,
  cause?: unknown,
  retry?: AppError["retry"],
): void {
  console.error(message, cause);
  // A cause that says why in plain words (the vault folder is gone, see lib/vaultRoot) goes into the toast; any other stays in the console
  const why =
    cause instanceof Error && cause.name === "VaultMissingError"
      ? `: ${cause.message}`
      : "";
  emit({ id: nextId++, message: message + why, retry });
}

/** Tells the user something that is not a failure, in the same toast. Never throws. */
export function reportNotice(message: string): void {
  emit({ id: nextId++, message, notice: true });
}

function emit(error: AppError): void {
  for (const listener of listeners) {
    try {
      listener(error);
    } catch (e) {
      console.error("reportError listener failed", e);
    }
  }
}
