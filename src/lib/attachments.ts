// src/lib/attachments.ts
// Pasted and dropped images are copied into <vault>/attachments/ and linked from the note by a
// path relative to the note ("../attachments/x.png"), which other markdown editors resolve too.
// The pure parts live here; reading and writing files is in attachmentStore.ts.

/** The folder at the vault root that holds the images. The folder tree hides it and refuses the name. */
export const ATTACH_DIR = "attachments";

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** The extension a pasted image of this type is saved with, or null when it is not one we keep. */
export function extForMime(mime: string): string | null {
  return (
    Object.entries(MIME_BY_EXT).find(
      ([ext, m]) => m === mime && ext !== "jpeg",
    )?.[0] ?? null
  );
}

export function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export const isImagePath = (path: string) => extOf(path) in MIME_BY_EXT;

export const mimeOf = (name: string) =>
  MIME_BY_EXT[extOf(name)] ?? "application/octet-stream";

/** Whether a new or renamed folder may use this name: not "attachments" at the vault root. */
export const isReservedFolderName = (name: string, parentId: string | null) =>
  parentId === null && name.trim().toLowerCase() === ATTACH_DIR;

// What saveImage names a file: 10 characters from nanoid's alphabet, then the extension
const OWN_NAME = /^[\w-]{10}\.\w+$/;

/**
 * The files in attachments/ that are safe to delete: pictures Graphene saved itself whose name no
 * note mentions. Looking for the bare name (not just a ![](...) link) keeps reference-style links,
 * wiki embeds and links inside code blocks working. ponytail: a hand-made 10-character name such as
 * "screenshot.png" also counts as ours.
 */
export function unusedImages(files: string[], notesText: string): string[] {
  const text = notesText.toLowerCase();
  return files.filter(
    (f) =>
      OWN_NAME.test(f) && isImagePath(f) && !text.includes(f.toLowerCase()),
  );
}

// How many folders deep a note sits: the number of "../" it takes to get back to the vault root
const depth = (folderId: string | null) =>
  folderId ? folderId.split("/").length : 0;

/** The link a note in `folderId` uses for the image `file`. */
export function attachmentLink(folderId: string | null, file: string): string {
  return `${"../".repeat(depth(folderId))}${ATTACH_DIR}/${file}`;
}

/**
 * The file an image link in a note points at, or null when it is not one of ours (a web address, or
 * a path that does not go through attachments/). Only the file name counts, so a link whose "../"
 * count is out of date (after a move or a restore) still shows its image.
 */
export function resolveAttachment(
  vaultPath: string,
  src: string,
): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return null;
  const m = /(?:^|\/)attachments\/([^/?#]+)$/.exec(src);
  if (!m) return null;
  let name = m[1];
  try {
    name = decodeURIComponent(name);
  } catch {
    // keep the name as written
  }
  const root = vaultPath.replace(/\\/g, "/").replace(/\/$/, "");
  return `${root}/${ATTACH_DIR}/${name}`;
}

/**
 * Rewrites the "../" count of the attachment links in `body` when its note moves from one folder to
 * another. ponytail: also rewrites such a link inside a code block.
 */
export function relinkAttachments(
  body: string,
  from: string | null,
  to: string | null,
): string {
  if (depth(from) === depth(to)) return body;
  return body.replace(
    /\]\((?:\.\.\/)*attachments\//g,
    `](${"../".repeat(depth(to))}${ATTACH_DIR}/`,
  );
}
