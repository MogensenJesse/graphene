// src/lib/platform.ts
// Where the page runs. The Android build is the same page in the system WebView, so the one thing that tells it apart is the user agent.

export const IS_ANDROID =
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

// The main input is a touch screen: nothing waits for a hover (the rules of `_Touch.scss` are under the same query)
export const IS_TOUCH =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

// A phone: a touch screen narrower than this has the list as a screen of its own (see `phone` in App), not a drawer
export const PHONE_QUERY = "(max-width: 599px) and (pointer: coarse)";

// What a person on a phone should know: the vault is inside the app, and nothing else keeps a copy (Settings, Vaults and About)
export const PRIVATE_VAULT_NOTICE =
  "Your notes are stored inside this app. Uninstalling the app, or clearing its storage, deletes them.";
