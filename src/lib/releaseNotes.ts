// src/lib/releaseNotes.ts
import { compareVersions } from "./version";

export const RELEASES_PAGE =
  "https://github.com/MogensenJesse/graphene/releases";
const RELEASES_API =
  "https://api.github.com/repos/MogensenJesse/graphene/releases?per_page=30";

export interface ReleaseNote {
  version: string; // without the leading "v"
  date: string; // ISO, "" when unknown
  body: string; // markdown
}

interface GithubRelease {
  tag_name: string;
  published_at: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
}

/** Published releases newer than `current` up to and including `latest`, newest first. */
export function selectReleases(
  releases: GithubRelease[],
  current: string,
  latest: string,
): ReleaseNote[] {
  return releases
    .filter(
      (r) =>
        !r.draft &&
        !r.prerelease &&
        compareVersions(r.tag_name, current) > 0 &&
        compareVersions(r.tag_name, latest) <= 0,
    )
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name))
    .map((r) => ({
      version: r.tag_name.replace(/^v/i, ""),
      date: r.published_at ?? "",
      body: r.body ?? "",
    }));
}

/**
 * Notes for every version between the installed one and the update, so an app that is several
 * versions behind shows them stacked. Any failure (offline, GitHub's 60 requests/hour limit for
 * unauthenticated callers) returns [] and the caller falls back to the update's own notes.
 */
export async function fetchReleaseNotes(
  current: string,
  latest: string,
): Promise<ReleaseNote[]> {
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return [];
    return selectReleases(
      (await res.json()) as GithubRelease[],
      current,
      latest,
    );
  } catch {
    return [];
  }
}
