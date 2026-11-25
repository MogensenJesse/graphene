// src/lib/columnWidth.ts
// How wide the text column of a note is: the user drags its edge (ui/ColumnResizer). One width for every note, kept in
// localStorage and put on <html> as --note-column, which the note surfaces read (the Tasks list, the Trash and the like keep the
// 720px of --column-width). `data-note-wide` says whether it is wider than the default, for the folder chip's gutter rule.
import { readPref, writePref } from "./prefs";

export const DEFAULT_WIDTH = 720; // the same as --column-width in base/_variables.scss
export const MIN_WIDTH = 480;
export const MAX_WIDTH = 1200;
const STEP = 8;
const SNAP = 12; // a width this close to the default is the default, so it is easy to get back to

const KEY = "graphene.noteWidth";

/** A width in px, in steps of 8 between the least and the most, and the default when close to it. */
export function clampWidth(width: number): number {
  const stepped = Math.round(width / STEP) * STEP;
  const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, stepped));
  return Math.abs(clamped - DEFAULT_WIDTH) <= SNAP ? DEFAULT_WIDTH : clamped;
}

/** The saved width, or the default when there is none or it is not a number. */
export function parseWidth(raw: string | null): number {
  const n = Number(raw);
  return raw !== null && raw.trim() !== "" && Number.isFinite(n)
    ? clampWidth(n)
    : DEFAULT_WIDTH;
}

/**
 * The width after an edge of the column was dragged `dx` px to the right. The column is centred, so the other edge moves the
 * other way by as much: the width changes by twice the drag, more for the right edge, less for the left.
 */
export function widthAfterDrag(
  start: number,
  dx: number,
  edge: "left" | "right",
): number {
  return clampWidth(start + (edge === "right" ? 2 * dx : -2 * dx));
}

let current: number | null = null;

export function getNoteWidth(): number {
  current ??= parseWidth(readPref(KEY));
  return current;
}

/** Puts `width` on <html>: the column follows at once, with no render of React. Once at start (`main.tsx`), and while dragging. */
export function applyNoteWidth(width: number = getNoteWidth()): void {
  current = width;
  const root = document.documentElement;
  root.style.setProperty("--note-column", `${width}px`);
  root.dataset.noteWide = String(width > DEFAULT_WIDTH);
}

/** Applies `width` and keeps it for the next start. */
export function saveNoteWidth(width: number): void {
  applyNoteWidth(width);
  writePref(KEY, String(width));
}
