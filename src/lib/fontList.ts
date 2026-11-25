// src/lib/fontList.ts
import { invoke } from "@tauri-apps/api/core";

/**
 * The families of the fonts installed on this computer, each once, in alphabetical order (the `list_fonts` command in
 * src-tauri/src/fonts.rs). Reading them takes a moment, so ask when a list is about to be needed, not at start.
 */
export const listFonts = (): Promise<string[]> =>
  invoke<string[]>("list_fonts");
