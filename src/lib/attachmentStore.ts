// src/lib/attachmentStore.ts
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { nanoid } from "nanoid";
import { createContext } from "react";
import { ATTACH_DIR } from "./attachments";
import { joinPath } from "./paths";

/** The vault folder, for the parts of the UI that have to find files in it (images in a note). */
export const VaultPathContext = createContext<string | null>(null);

/** Writes an image into <vault>/attachments under a new name and returns that file name. */
export async function saveImage(
  vaultPath: string,
  bytes: Uint8Array,
  ext: string,
): Promise<string> {
  const dir = joinPath(vaultPath, ATTACH_DIR);
  await mkdir(dir, { recursive: true });
  const name = `${nanoid(10)}.${ext}`;
  await writeFile(joinPath(dir, name), bytes);
  return name;
}
