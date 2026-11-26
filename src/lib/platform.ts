// src/lib/platform.ts
// Where the page runs. The Android build is the same page in the system WebView, so the one thing that tells it apart is the user agent.

export const IS_ANDROID =
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
