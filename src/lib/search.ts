// src/lib/search.ts
import type { Snippet } from "../types";

/**
 * Pure filter function — filters snippets by search query (title + tags) and active tag.
 */
export function filterSnippets(
  snippets: Snippet[],
  query: string,
  activeTag: string,
): Snippet[] {
  const q = query.trim().toLowerCase();

  return snippets.filter((snippet) => {
    const matchesTag = activeTag === "all" || snippet.tags.includes(activeTag);

    const matchesQuery =
      !q ||
      snippet.title.toLowerCase().includes(q) ||
      snippet.tags.some((tag) => tag.toLowerCase().includes(q));

    return matchesTag && matchesQuery;
  });
}
