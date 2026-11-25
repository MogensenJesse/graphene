// src/lib/windowShow.ts
// The window is created hidden (tauri.conf.json: "visible": false), so nobody sees an empty acrylic rectangle while the page loads.
// The page shows it once it has something to look at: the loaded lists, the vault picker, the "vault unavailable" screen or the error
// panel. If it never gets there, Rust shows the window anyway a few seconds after start (src-tauri/src/lib.rs,
// `show_window_if_still_hidden`), so the app cannot stay invisible.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { perfMark } from "./perf";

// A hidden webview may not run animation frames at all, so the wait for one is capped
export const FRAME_WAIT_MS = 50;

let called = false;

/**
 * Shows the window, once, after the next frame (what React has just committed is painted by then) or after FRAME_WAIT_MS when no
 * frame comes. Call it from an effect, so the screen is committed. Never throws: a failed show is logged, and Rust's timer still shows.
 */
export function showWindow(): void {
  if (called) return;
  called = true;
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
    setTimeout(resolve, FRAME_WAIT_MS);
  })
    .then(() => getCurrentWindow().show())
    .then(() => perfMark("window-shown"))
    .catch((err) => console.error("[window] could not show the window:", err));
}
