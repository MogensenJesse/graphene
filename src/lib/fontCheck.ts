// src/lib/fontCheck.ts
import { cleanFontName } from "./fontPrefs";

const SAMPLE = "mmmmmmmmmmlli1WwQ@#";
const BASES = ["monospace", "serif", "sans-serif"];

/**
 * Whether a font is installed. A missing font silently falls back, so a typo in Settings would look like
 * nothing happened. A sample is measured in the font against each generic family; an installed font changes the width.
 */
export function fontInstalled(name: string): boolean {
  const clean = cleanFontName(name);
  const ctx = document.createElement("canvas").getContext("2d");
  if (!clean || !ctx) return true; // cannot tell: say nothing rather than a false alarm
  const width = (family: string) => {
    ctx.font = `64px ${family}`;
    return ctx.measureText(SAMPLE).width;
  };
  return BASES.some((base) => width(`"${clean}", ${base}`) !== width(base));
}
