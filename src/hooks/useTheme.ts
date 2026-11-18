// src/hooks/useTheme.ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { readPref, writePref } from "../lib/prefs";

type ThemePref = "system" | "light" | "dark";

/** The order the theme button cycles through. */
const THEME_ORDER: ThemePref[] = ["system", "light", "dark"];

const THEME_KEY = "graphene.theme";

export function readThemePref(): ThemePref {
  const stored = readPref(THEME_KEY);
  return THEME_ORDER.find((t) => t === stored) ?? "system";
}

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

/**
 * Puts the theme on <html> (not .app: menus, tooltips and dialogs live outside it) and on the
 * window itself, so the Windows backdrop and the native scrollbars match. "system" hands the choice
 * back to the OS. Called before the first render so the wrong theme never flashes.
 */
export function applyTheme(pref: ThemePref): void {
  const dark = pref === "system" ? systemDark.matches : pref === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  getCurrentWindow()
    .setTheme(pref === "system" ? null : pref)
    .catch(console.error);
}

export function useTheme(): { pref: ThemePref; cycle: () => void } {
  const [pref, setPref] = useState(readThemePref);

  useEffect(() => {
    applyTheme(pref);
    if (pref !== "system") return;
    // Following the OS: it can flip while the app is open, and handing the window back to the OS
    // (setTheme(null)) is only seen by the media query a moment later
    const onChange = () => applyTheme("system");
    systemDark.addEventListener("change", onChange);
    return () => systemDark.removeEventListener("change", onChange);
  }, [pref]);

  const cycle = () => {
    const next =
      THEME_ORDER[(THEME_ORDER.indexOf(pref) + 1) % THEME_ORDER.length];
    setPref(next);
    writePref(THEME_KEY, next);
  };

  return { pref, cycle };
}
