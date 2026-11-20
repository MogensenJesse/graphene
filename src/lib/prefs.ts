// src/lib/prefs.ts
// Small per-user preferences kept in localStorage. It can be missing or throw (blocked storage), and a
// preference is only a convenience, so every access falls back quietly.
import { pathKey } from "./vaultList";

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

function removePref(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Left as it was
  }
}

const COLLAPSED_KEY = "graphene.collapsedByVault";
// Before there were several vaults: one list of folder paths for the only vault
const LEGACY_COLLAPSED_KEY = "graphene.collapsed";

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];

function parseJson(raw: string | null): unknown {
  try {
    return JSON.parse(raw ?? "null");
  } catch {
    return null; // Corrupt value: start with none collapsed
  }
}

// Read once: every folder row asks when it appears. A folder path means something only inside its own vault.
let collapsed: Map<string, Set<string>> | undefined;

function collapsedByVault(): Map<string, Set<string>> {
  if (!collapsed) {
    collapsed = new Map();
    const saved = parseJson(readPref(COLLAPSED_KEY));
    if (typeof saved === "object" && saved !== null && !Array.isArray(saved))
      for (const [vault, ids] of Object.entries(saved))
        collapsed.set(vault, new Set(stringsOf(ids)));
  }
  return collapsed;
}

function saveCollapsed(all: Map<string, Set<string>>): void {
  writePref(
    COLLAPSED_KEY,
    JSON.stringify(
      Object.fromEntries([...all].map(([vault, ids]) => [vault, [...ids]])),
    ),
  );
}

function collapsedFolders(vault: string): Set<string> {
  const all = collapsedByVault();
  const key = pathKey(vault);
  let ids = all.get(key);
  if (!ids) {
    // The first vault opened after the upgrade is the one the old single list belonged to
    ids = new Set(stringsOf(parseJson(readPref(LEGACY_COLLAPSED_KEY))));
    all.set(key, ids);
    saveCollapsed(all);
    removePref(LEGACY_COLLAPSED_KEY);
  }
  return ids;
}

export const isFolderCollapsed = (vault: string, id: string) =>
  collapsedFolders(vault).has(id);

export function setFolderCollapsed(
  vault: string,
  id: string,
  isCollapsed: boolean,
): void {
  const ids = collapsedFolders(vault);
  if (isCollapsed) ids.add(id);
  else ids.delete(id);
  saveCollapsed(collapsedByVault());
}
