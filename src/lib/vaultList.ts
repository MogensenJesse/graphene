// src/lib/vaultList.ts
// The list of vaults in config.json, with no file or app code in it: the app (src/lib/vault.ts) and the MCP server
// (mcp/vault.ts) both read the file through this, so they agree on what it means.
//
// {
//   "active": "<path of the vault open in the app>",
//   "vaultPath": "<the same, for Graphene and MCP servers from before there were several vaults>",
//   "vaults": [ { "path": "...", "name": "Notes", "shared": true } ]
// }
import { joinPath } from "./paths";

export interface VaultEntry {
  path: string;
  name: string;
  /** Whether AI assistants may use it */
  shared: boolean;
}

export interface VaultConfig {
  /** Path of the open vault; null when there are no vaults */
  active: string | null;
  vaults: VaultEntry[];
  /** Keys this code does not know (a newer Graphene wrote them): written back as they were */
  extra: Record<string, unknown>;
}

export const EMPTY_CONFIG: VaultConfig = {
  active: null,
  vaults: [],
  extra: {},
};

/** What two paths are compared by: "/" for "\", no trailing slash, and Windows' case-blindness */
export const pathKey = (path: string): string => joinPath(path).toLowerCase();

const samePath = (a: string, b: string) => pathKey(a) === pathKey(b);

const isInside = (child: string, parent: string) =>
  pathKey(child).startsWith(`${pathKey(parent)}/`);

/** The folder's own name; "Vault" for a bare drive such as D:\ */
export function folderName(path: string): string {
  const last = joinPath(path).split("/").pop() ?? "";
  return last === "" || last.endsWith(":") ? "Vault" : last;
}

/** `name`, or "name 2", "name 3"... when another vault (not `exceptPath`) already has it. Case does not matter. */
function uniqueName(
  name: string,
  vaults: VaultEntry[],
  exceptPath?: string,
): string {
  const taken = new Set(
    vaults
      .filter((v) => exceptPath === undefined || !samePath(v.path, exceptPath))
      .map((v) => v.name.toLowerCase()),
  );
  let candidate = name;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++)
    candidate = `${name} ${n}`;
  return candidate;
}

function readEntry(
  value: unknown,
): { path: string; name: string | null; shared: boolean } | null {
  if (typeof value !== "object" || value === null) return null;
  const { path, name, shared } = value as Record<string, unknown>;
  if (typeof path !== "string" || path.trim() === "") return null;
  return {
    path,
    name: typeof name === "string" && name.trim() !== "" ? name.trim() : null,
    shared: shared !== false, // sharing is on unless it was switched off
  };
}

/**
 * Reads the parsed JSON of config.json. The old shape, { "vaultPath": "..." }, becomes one shared vault.
 * Entries that are not objects with a path are dropped, repeated paths and names are made unique.
 */
export function parseVaultConfig(raw: unknown): VaultConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return { ...EMPTY_CONFIG, extra: {} };
  const { active, vaultPath, vaults, ...extra } = raw as Record<
    string,
    unknown
  >;

  const entries = Array.isArray(vaults)
    ? vaults.map(readEntry)
    : typeof vaultPath === "string" && vaultPath.trim() !== ""
      ? [readEntry({ path: vaultPath })]
      : [];

  const list: VaultEntry[] = [];
  for (const entry of entries) {
    if (!entry || list.some((v) => samePath(v.path, entry.path))) continue;
    list.push({
      ...entry,
      name: uniqueName(entry.name ?? folderName(entry.path), list),
    });
  }

  // The open vault: the one named by `active`, else by the old `vaultPath`, else the first
  const open =
    [active, vaultPath]
      .map((p) => (typeof p === "string" ? findVault(list, p) : undefined))
      .find((v) => v !== undefined) ?? list[0];
  return { active: open?.path ?? null, vaults: list, extra };
}

/** The JSON to write: what was kept, the vaults, the open one, and `vaultPath` for the older programs that read it */
export function serializeVaultConfig(
  config: VaultConfig,
): Record<string, unknown> {
  const active = findVault(config.vaults, config.active);
  // An older program has one vault in mind; it must not be handed one that is not shared
  const legacy =
    active?.shared === true ? active : config.vaults.find((v) => v.shared);
  return {
    ...config.extra,
    ...(config.active ? { active: config.active } : {}),
    ...(legacy ? { vaultPath: legacy.path } : {}),
    vaults: config.vaults,
  };
}

export function findVault(
  vaults: VaultEntry[],
  path: string | null,
): VaultEntry | undefined {
  return path === null ? undefined : vaults.find((v) => samePath(v.path, path));
}

export const sharedVaults = (config: VaultConfig): VaultEntry[] =>
  config.vaults.filter((v) => v.shared);

export type VaultProblem = {
  /** the folder is already a vault, is inside one, or has one inside it */
  kind: "duplicate" | "inside" | "contains";
  vault: VaultEntry;
};

export function vaultProblemText({ kind, vault }: VaultProblem): string {
  if (kind === "duplicate")
    return `That folder is already a vault ("${vault.name}").`;
  const where = kind === "inside" ? "is inside" : "has";
  const tail = kind === "inside" ? "" : " inside it";
  return `That folder ${where} the vault "${vault.name}"${tail}. Vaults cannot overlap, or notes would show twice.`;
}

/** Notes found twice (the inner vault's are also in the outer one's folders) make a mess, so vaults may not overlap */
export function checkNewVault(
  config: VaultConfig,
  path: string,
): VaultProblem | null {
  for (const vault of config.vaults) {
    if (samePath(vault.path, path)) return { kind: "duplicate", vault };
    if (isInside(path, vault.path)) return { kind: "inside", vault };
    if (isInside(vault.path, path)) return { kind: "contains", vault };
  }
  return null;
}

/** Adds a vault at the end, shared. It does not become the open one. */
export function addVault(
  config: VaultConfig,
  path: string,
): { config: VaultConfig; entry: VaultEntry } | VaultProblem {
  const problem = checkNewVault(config, path);
  if (problem) return problem;
  const entry: VaultEntry = {
    path,
    name: uniqueName(folderName(path), config.vaults),
    shared: true,
  };
  return {
    config: {
      ...config,
      active: config.active ?? path,
      vaults: [...config.vaults, entry],
    },
    entry,
  };
}

/** Takes a vault off the list (never its folder). When it was the open one, the first remaining one is. */
export function removeVault(config: VaultConfig, path: string): VaultConfig {
  const vaults = config.vaults.filter((v) => !samePath(v.path, path));
  const keeps = findVault(vaults, config.active);
  return { ...config, vaults, active: keeps?.path ?? vaults[0]?.path ?? null };
}

/** null when the name is empty or another vault has it */
export function renameVault(
  config: VaultConfig,
  path: string,
  name: string,
): VaultConfig | null {
  const clean = name.trim();
  if (clean === "") return null;
  const others = config.vaults.filter((v) => !samePath(v.path, path));
  if (others.some((v) => v.name.toLowerCase() === clean.toLowerCase()))
    return null;
  return mapVault(config, path, (v) => ({ ...v, name: clean }));
}

export const setShared = (
  config: VaultConfig,
  path: string,
  shared: boolean,
): VaultConfig => mapVault(config, path, (v) => ({ ...v, shared }));

/** The vault with this path becomes the open one; a path that is not on the list changes nothing */
export function setActive(config: VaultConfig, path: string): VaultConfig {
  const vault = findVault(config.vaults, path);
  return vault ? { ...config, active: vault.path } : config;
}

/** One place up (-1) or down (1) the list */
export function moveVault(
  config: VaultConfig,
  path: string,
  delta: -1 | 1,
): VaultConfig {
  const from = config.vaults.findIndex((v) => samePath(v.path, path));
  const to = from + delta;
  if (from < 0 || to < 0 || to >= config.vaults.length) return config;
  const vaults = [...config.vaults];
  [vaults[from], vaults[to]] = [vaults[to], vaults[from]];
  return { ...config, vaults };
}

function mapVault(
  config: VaultConfig,
  path: string,
  change: (vault: VaultEntry) => VaultEntry,
): VaultConfig {
  return {
    ...config,
    vaults: config.vaults.map((v) => (samePath(v.path, path) ? change(v) : v)),
  };
}
