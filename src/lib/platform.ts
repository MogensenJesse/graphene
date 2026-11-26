// src/lib/platform.ts
// Where the page runs. The Android build is the same page in the system WebView, so the one thing that tells it apart is the user agent.

export const IS_ANDROID =
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

// What a person on a phone should know: the vault is inside the app, and nothing else keeps a copy (Settings, Vaults and About)
export const PRIVATE_VAULT_NOTICE =
  "Your notes are stored inside this app. Uninstalling the app, or clearing its storage, deletes them.";
