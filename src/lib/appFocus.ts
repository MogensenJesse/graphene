// src/lib/appFocus.ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IS_ANDROID } from "./platform";

/**
 * Calls `onFocus` each time the app comes back to the front: the window gets focus on a computer, the page becomes visible again
 * on Android (which has no window focus). Returns the function that stops listening.
 */
export function onAppFocus(onFocus: () => void): () => void {
  if (IS_ANDROID) {
    const onVisible = () => {
      if (!document.hidden) onFocus();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }
  const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
    if (focused) onFocus();
  });
  return () => {
    unlisten.then((fn) => fn()).catch(console.error);
  };
}
