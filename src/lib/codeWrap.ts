// src/lib/codeWrap.ts
// Whether long lines of code wrap onto the next row or scroll sideways: one global choice, "on" until the user changes
// it. It is kept in localStorage and shown as `data-code-wrap` on <html>, so the stylesheet reads it; the editor reads it
// through `useCodeWrap` (hooks/useCodeWrap.ts), which renders again when the choice changes (Alt+Z, Settings).
import { readPref, writePref } from "./prefs";

export type CodeWrap = "on" | "off";

const KEY = "graphene.codeWrap";

/** Anything but a saved "off" is on. */
export const parseCodeWrap = (raw: string | null): CodeWrap =>
  raw === "off" ? "off" : "on";

let current: CodeWrap | null = null;
const listeners = new Set<() => void>();

export function getCodeWrap(): CodeWrap {
  current ??= parseCodeWrap(readPref(KEY));
  return current;
}

export function subscribeCodeWrap(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Puts the choice on <html>. Once at start (`main.tsx`), and after each change. */
export function applyCodeWrap(): void {
  document.documentElement.dataset.codeWrap = getCodeWrap();
}

export function setCodeWrap(next: CodeWrap): void {
  current = next;
  writePref(KEY, next);
  applyCodeWrap();
  for (const listener of listeners) listener();
}

export const toggleCodeWrap = (): void =>
  setCodeWrap(getCodeWrap() === "on" ? "off" : "on");
