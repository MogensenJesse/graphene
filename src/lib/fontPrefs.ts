// src/lib/fontPrefs.ts
// The reading and editing fonts and the text size. They are kept in localStorage and applied as CSS variables on <html>
// (--font-note, --font-editor, --font-code, --text-scale; see base/_variables.scss), so they take effect before the first render.
import { readPref, writePref } from "./prefs";

export type FontKind = "note" | "code";

/** A choice from the lists below, plus the typed name when the choice is "custom" */
export interface FontPref {
  choice: string;
  custom: string;
}

interface FontChoice {
  value: string;
  label: string;
  /** CSS font-family list; null for "default" (leave the app's own font) and "custom" (typed name) */
  stack: string | null;
}

export const FONT_CHOICES: Record<FontKind, FontChoice[]> = {
  note: [
    { value: "default", label: "Default", stack: null },
    {
      value: "system",
      label: "System",
      stack: '"Segoe UI", system-ui, sans-serif',
    },
    {
      value: "serif",
      label: "Serif",
      stack: 'Georgia, "Times New Roman", serif',
    },
    { value: "custom", label: "Custom", stack: null },
  ],
  code: [
    { value: "default", label: "Default", stack: null },
    { value: "consolas", label: "Consolas", stack: "Consolas, monospace" },
    {
      value: "courier",
      label: "Courier New",
      stack: '"Courier New", monospace',
    },
    { value: "custom", label: "Custom", stack: null },
  ],
};

// What a typed name falls back to when the font is not installed
const FALLBACK: Record<FontKind, string> = {
  note: "var(--font-sans)",
  code: "var(--font-mono)",
};

const FONT_KEY: Record<FontKind, string> = {
  note: "graphene.noteFont",
  code: "graphene.codeFont",
};
const SIZE_KEY = "graphene.textSize";

export const TEXT_SIZES = [
  { value: "small", label: "Small", scale: 0.9 },
  { value: "default", label: "Default", scale: 1 },
  { value: "large", label: "Large", scale: 1.15 },
  { value: "xlarge", label: "Extra large", scale: 1.3 },
];

const DEFAULT_PREF: FontPref = { choice: "default", custom: "" };

/** A font name made safe to put between quotes in a CSS font-family list */
export function cleanFontName(name: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters (a pasted newline) would end the quoted name
  return name.replace(/["\\\u0000-\u001f]/g, "").trim();
}

/** "serif", or "custom:Fira Sans" for a typed name; anything unknown reads as the default */
export function parseFontPref(raw: string | null, kind: FontKind): FontPref {
  if (raw?.startsWith("custom:"))
    return { choice: "custom", custom: raw.slice("custom:".length) };
  const known = FONT_CHOICES[kind].some(
    (c) => c.value === raw && c.value !== "custom",
  );
  return known && raw ? { choice: raw, custom: "" } : { ...DEFAULT_PREF };
}

export function serializeFontPref(pref: FontPref): string {
  return pref.choice === "custom" ? `custom:${pref.custom}` : pref.choice;
}

/** The font-family to apply, or null to leave the app's own font */
export function fontCss(kind: FontKind, pref: FontPref): string | null {
  if (pref.choice === "custom") {
    const name = cleanFontName(pref.custom);
    return name ? `"${name}", ${FALLBACK[kind]}` : null;
  }
  return FONT_CHOICES[kind].find((c) => c.value === pref.choice)?.stack ?? null;
}

/** The multiplier of a stored size name; 1 for anything unknown */
export function textScale(size: string | null): number {
  return TEXT_SIZES.find((s) => s.value === size)?.scale ?? 1;
}

export const readFontPref = (kind: FontKind): FontPref =>
  parseFontPref(readPref(FONT_KEY[kind]), kind);

export const readTextSize = (): string =>
  TEXT_SIZES.find((s) => s.value === readPref(SIZE_KEY))?.value ?? "default";

function setVar(name: string, value: string | null): void {
  const style = document.documentElement.style;
  if (value === null) style.removeProperty(name);
  else style.setProperty(name, value);
}

/** Puts the saved fonts and size on <html>. Once at start, and again after each change. */
export function applyFontPrefs(): void {
  const note = fontCss("note", readFontPref("note"));
  const scale = textScale(readTextSize());
  setVar("--font-note", note);
  setVar("--font-editor", note); // the editor follows the note font; with the default it stays in the code font
  setVar("--font-code", fontCss("code", readFontPref("code")));
  setVar("--text-scale", scale === 1 ? null : String(scale));
}

export function setFontPref(kind: FontKind, pref: FontPref): void {
  writePref(FONT_KEY[kind], serializeFontPref(pref));
  applyFontPrefs();
}

export function setTextSize(size: string): void {
  writePref(SIZE_KEY, size);
  applyFontPrefs();
}
