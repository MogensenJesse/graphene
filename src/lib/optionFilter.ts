// src/lib/optionFilter.ts

/**
 * The options whose label has the query in it, upper or lower case alike. Those that start with it come first, then the rest,
 * each group in its own order. An empty query keeps them all.
 */
export function filterOptions<T extends { label: string }>(
  options: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  const starts: T[] = [];
  const contains: T[] = [];
  for (const option of options) {
    const at = option.label.toLowerCase().indexOf(q);
    if (at === 0) starts.push(option);
    else if (at > 0) contains.push(option);
  }
  return [...starts, ...contains];
}
