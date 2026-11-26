// src/lib/theme.ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readPref, writePref } from "./prefs";

declare global {
  interface Window {
    // Android only (MainActivity's BarsBridge): the status and navigation bars' icons follow the page's theme, not the phone's mode
    grapheneBars?: { setDark(dark: boolean): void };
  }
}

export type ThemePref = "system" | "light" | "dark";

export const THEME_PREFS: ThemePref[] = ["system", "light", "dark"];

const THEME_KEY = "graphene.theme";

export function readThemePref(): ThemePref {
  const stored = readPref(THEME_KEY);
  return THEME_PREFS.find((t) => t === stored) ?? "system";
}

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

/**
 * Puts the theme on <html> (not .app: menus, tooltips and dialogs live outside it) and on the
 * window itself, so the Windows backdrop and the native scrollbars match. "system" hands the choice
 * back to the OS.
 */
function applyTheme(pref: ThemePref): void {
  const dark = pref === "system" ? systemDark.matches : pref === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  window.grapheneBars?.setDark(dark);
  getCurrentWindow()
    .setTheme(pref === "system" ? null : pref)
    .catch(console.error);
}

export function setThemePref(pref: ThemePref): void {
  writePref(THEME_KEY, pref);
  applyTheme(pref);
}

/** Once, before the first render, so the wrong theme never flashes. */
export function initTheme(): void {
  applyTheme(readThemePref());
  // Following the OS: it can flip while the app is open, and handing the window back to the OS
  // (setTheme(null)) is only seen by the media query a moment later
  systemDark.addEventListener("change", () => {
    if (readThemePref() === "system") applyTheme("system");
  });
}
