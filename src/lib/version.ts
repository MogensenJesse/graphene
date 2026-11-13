// src/lib/version.ts

/** Numeric parts of "v1.2.3" or "1.2.3-beta.1" (pre-release suffixes are ignored). */
const parts = (version: string): number[] =>
  version
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);

/** Negative when a < b, positive when a > b, 0 when equal. A missing part counts as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
