// src/lib/leaveGate.ts
// The rule at a point of no return, where unsaved text would be lost: the window closes, another vault opens (pure, tested).

/**
 * `saved`: no note or task write is failed or unsaved. `warned`: the last attempt to leave was held back and said why.
 * Going on resets `warned`, so the next failure holds the next attempt back again. A disk that keeps failing never traps
 * the person: the second attempt goes through (the first one showed the toast, with its Retry).
 */
export function leaveGate(
  saved: boolean,
  warned: boolean,
): { go: boolean; warned: boolean } {
  if (saved || warned) return { go: true, warned: false };
  return { go: false, warned: true };
}
