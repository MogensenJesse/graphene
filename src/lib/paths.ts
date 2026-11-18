// src/lib/paths.ts
// Path helpers. Paths here use "/" (Windows accepts it too), so one that came from the OS with "\" is
// run through joinPath first.

/** Joins parts with "/", turning "\" into "/" and dropping doubled and trailing slashes. */
export function joinPath(...parts: string[]): string {
  return parts
    .join("/")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

/** `absolute` relative to `root`, with no leading slash; unchanged when it is not inside `root`. */
export function relativePath(root: string, absolute: string): string {
  const base = joinPath(root);
  const abs = joinPath(absolute);
  return abs.startsWith(`${base}/`) ? abs.slice(base.length + 1) : abs;
}

/** The last part of a path, which must already use "/". */
export const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** The lower-case extension of a file name without its dot, or "" when it has none. */
export function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}
