// src/lib/attachmentStore.ts
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { nanoid } from "nanoid";
import { createContext } from "react";
import {
  ATTACH_DIR,
  fitWithin,
  MAX_IMAGE_SIDE,
  reencodeMime,
} from "./attachments";
import { joinPath } from "./paths";
import { requireRoot } from "./vaultRoot";

/** The vault folder, for the parts of the UI that have to find files in it (images in a note). */
export const VaultPathContext = createContext<string | null>(null);

// The quality of a scaled-down JPEG or WebP (PNG has none)
const SHRINK_QUALITY = 0.9;

/**
 * The bytes to store for a picture: a PNG, JPEG or WebP longer than MAX_IMAGE_SIDE on its longer side
 * is scaled down on a canvas (aspect kept, same type, the EXIF turn applied), when that makes the
 * file smaller. Everything else, and any failure, is stored as it came.
 */
async function shrinkImage(
  bytes: Uint8Array<ArrayBuffer>,
  ext: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const mime = reencodeMime(ext);
  if (!mime) return bytes;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: mime }), {
      imageOrientation: "from-image",
    });
    const { width, height } = fitWithin(
      bitmap.width,
      bitmap.height,
      MAX_IMAGE_SIDE,
    );
    if (width === bitmap.width && height === bitmap.height) return bytes;
    const ctx = new OffscreenCanvas(width, height).getContext("2d");
    if (!ctx) return bytes;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await ctx.canvas.convertToBlob({
      type: mime,
      quality: SHRINK_QUALITY,
    });
    if (blob.type !== mime) return bytes; // the browser fell back to another type
    const out = new Uint8Array(await blob.arrayBuffer());
    return out.length < bytes.length ? out : bytes;
  } catch (err) {
    console.warn("[saveImage] kept the original size", err);
    return bytes;
  } finally {
    bitmap?.close();
  }
}

/**
 * Writes an image into <vault>/attachments under a new name (scaled down first when it is large, see
 * `shrinkImage`) and returns that file name.
 */
export async function saveImage(
  vaultPath: string,
  bytes: Uint8Array<ArrayBuffer>,
  ext: string,
): Promise<string> {
  const dir = joinPath(vaultPath, ATTACH_DIR);
  await requireRoot(vaultPath); // a vault that is gone is not made again to hold a picture
  const data = await shrinkImage(bytes, ext);
  await mkdir(dir, { recursive: true });
  const name = `${nanoid(10)}.${ext}`;
  await writeFile(joinPath(dir, name), data);
  return name;
}
