// src/lib/prefs.ts
// Small per-user preferences kept in localStorage. It can be missing or throw (blocked storage), and a
// preference is only a convenience, so every access falls back quietly.

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saved; the choice still applies for this session
  }
}

const COLLAPSED_KEY = "graphene.collapsed";

// Read once: every folder row asks when it appears
let collapsed: Set<string> | undefined;

function collapsedFolders(): Set<string> {
  if (!collapsed) {
    let ids: unknown = [];
    try {
      ids = JSON.parse(readPref(COLLAPSED_KEY) ?? "[]");
    } catch {
      // Corrupt value: start with none collapsed
    }
    collapsed = new Set(
      Array.isArray(ids)
        ? ids.filter((v): v is string => typeof v === "string")
        : [],
    );
  }
  return collapsed;
}

export const isFolderCollapsed = (id: string) => collapsedFolders().has(id);

export function setFolderCollapsed(id: string, isCollapsed: boolean): void {
  const set = collapsedFolders();
  if (isCollapsed) set.add(id);
  else set.delete(id);
  writePref(COLLAPSED_KEY, JSON.stringify([...set]));
}
