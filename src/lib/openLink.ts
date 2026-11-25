// src/lib/openLink.ts
// Apart from markdown.tsx so the note view can open a link without pulling in the Markdown renderer (which is loaded on demand).
import { openUrl } from "@tauri-apps/plugin-opener";

/** Hands a web or mail link to the default app; anything else (file:, javascript:) is ignored. */
export function openLink(href?: string): void {
  if (href && /^(https?:|mailto:)/i.test(href)) {
    openUrl(href).catch(console.error);
  }
}
