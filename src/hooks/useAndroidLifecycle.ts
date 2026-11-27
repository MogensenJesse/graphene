// src/hooks/useAndroidLifecycle.ts
import { exit, onBackButtonPress } from "@tauri-apps/api/app";
import { useEffect } from "react";
import { runBack } from "../lib/backStack";
import { IS_ANDROID } from "../lib/platform";

/**
 * What only Android asks of the app. The Back key closes the innermost thing that is open (see backStack), and with nothing open it
 * leaves the app the way closing the window does: `tryLeave` says whether it may (after the pending save, held back once when
 * something could not be saved). And a backgrounded app can be killed at any moment, so what is typed is saved as soon as the page is
 * hidden (Home, the app switcher, the screen going off) instead of when the autosave delay ends.
 */
export function useAndroidLifecycle(
  tryLeave: () => Promise<boolean>,
  saveNow: () => unknown,
): void {
  useEffect(() => {
    if (!IS_ANDROID) return;
    const listener = onBackButtonPress(async () => {
      if (runBack()) return;
      if (await tryLeave()) await exit(0);
    });
    return () => {
      listener.then((l) => l.unregister()).catch(console.error);
    };
  }, [tryLeave]);

  useEffect(() => {
    if (!IS_ANDROID) return;
    const save = () => void saveNow();
    const onVisibility = () => {
      if (document.hidden) save();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", save);
    };
  }, [saveNow]);
}
