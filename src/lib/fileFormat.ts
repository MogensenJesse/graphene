// src/lib/fileFormat.ts
import type { Item } from "../types";

// ---------------------------------------------------------------------------
// Items — YAML frontmatter + markdown body, always stored as .md
// ---------------------------------------------------------------------------

/**
 * Minimal YAML frontmatter parser — handles scalar key:value pairs only.
 * Values are not type-coerced beyond stripping surrounding quotes.
 */
function parseYamlFrontmatter(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

export function parseNoteFile(raw: string): Item {
  const withoutBom = raw.startsWith("﻿") ? raw.slice(1) : raw;
  const fenceEnd = withoutBom.indexOf("\n---", 4);
  if (withoutBom.startsWith("---\n") && fenceEnd !== -1) {
    const frontmatterBlock = withoutBom.slice(4, fenceEnd);
    const body = withoutBom.slice(fenceEnd + 4).replace(/^\n/, "");
    const meta = parseYamlFrontmatter(frontmatterBlock);
    return {
      id: meta.id ?? "",
      title: meta.title ?? "",
      folderId:
        meta.folderId && meta.folderId !== "null" ? meta.folderId : null,
      createdAt: meta.createdAt ?? new Date().toISOString(),
      updatedAt: meta.updatedAt ?? new Date().toISOString(),
      body,
    };
  }
  // Fallback: no frontmatter — treat whole file as body
  return {
    id: "",
    title: "",
    folderId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: withoutBom,
  };
}

export function serializeItem(item: Item): string {
  const folderLine =
    item.folderId !== null ? `folderId: ${item.folderId}` : "folderId: null";
  return [
    "---",
    `id: ${item.id}`,
    `title: ${item.title}`,
    folderLine,
    `createdAt: ${item.createdAt}`,
    `updatedAt: ${item.updatedAt}`,
    "---",
    item.body,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Code blocks
// ---------------------------------------------------------------------------

/** Extensions of code files that can be dropped in (and that old snippets were stored as). */
export const CODE_EXTS = new Set([
  ".js",
  ".ts",
  ".css",
  ".scss",
  ".html",
  ".sh",
]);

/** Wrap code in a fenced block whose fence is longer than any backtick run inside the code. */
export function fence(code: string, lang: string): string {
  const longest = Math.max(
    2,
    ...(code.match(/^`+/gm) ?? []).map((run) => run.length),
  );
  const ticks = "`".repeat(longest + 1);
  const text = code.replace(/\r\n/g, "\n").replace(/\n$/, "");
  return `${ticks}${lang}\n${text}\n${ticks}`;
}

// ---------------------------------------------------------------------------
// Legacy snippets — read only, to convert them to notes on first launch
// ---------------------------------------------------------------------------

export interface LegacySnippet {
  id: string;
  title: string;
  folderId: string | null;
  lang: string;
  note: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

const PREFIX = "@graphene:";

function extractMetaJson(firstLine: string): string | null {
  // Try: // @graphene:{...}
  let idx = firstLine.indexOf(`// ${PREFIX}`);
  if (idx !== -1) return firstLine.slice(idx + 3 + PREFIX.length);

  // Try: /* @graphene:{...} */
  idx = firstLine.indexOf(`/* ${PREFIX}`);
  if (idx !== -1) {
    const inner = firstLine.slice(idx + 3 + PREFIX.length);
    return inner.endsWith(" */") ? inner.slice(0, -3).trimEnd() : inner;
  }

  // Try: <!-- @graphene:{...} -->
  idx = firstLine.indexOf(`<!-- ${PREFIX}`);
  if (idx !== -1) {
    const inner = firstLine.slice(idx + 5 + PREFIX.length);
    return inner.endsWith(" -->") ? inner.slice(0, -4).trimEnd() : inner;
  }

  // Try: # @graphene:{...}
  idx = firstLine.indexOf(`# ${PREFIX}`);
  if (idx !== -1) return firstLine.slice(idx + 2 + PREFIX.length);

  return null;
}

/** A JSON-LD snippet used to be a .md file whose frontmatter said `type: snippet`. */
export function isLegacySnippetMd(raw: string): boolean {
  return /^type:\s*["']?snippet["']?\s*$/m.test(raw.slice(0, 200));
}

/** Old snippet file: metadata JSON in a comment on line 1, code below. Null without usable metadata. */
export function parseLegacySnippet(
  raw: string,
  ext: string,
): LegacySnippet | null {
  const lines = raw.split("\n");
  const json = extractMetaJson(lines[0] ?? "");
  if (!json) return null;
  try {
    const meta = JSON.parse(json) as Partial<LegacySnippet>;
    if (!meta.id) return null;
    return {
      id: meta.id,
      title: meta.title ?? "",
      folderId: meta.folderId ?? null,
      lang: meta.lang ?? ext.slice(1),
      note: meta.note ?? "",
      code: lines.slice(1).join("\n").replace(/^\n/, ""),
      createdAt: meta.createdAt ?? new Date().toISOString(),
      updatedAt: meta.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Code goes into a fenced block (the old language becomes the fence tag), its notes text below. */
export function legacyToItem(
  snippet: LegacySnippet,
  folderId: string | null,
): Item {
  // JS, TS, CSS, SCSS, HTML, Bash become js, ts, css, scss, html, bash
  const lang = snippet.lang === "JSON-LD" ? "json" : snippet.lang.toLowerCase();
  return {
    id: snippet.id,
    title: snippet.title,
    folderId,
    createdAt: snippet.createdAt,
    updatedAt: snippet.updatedAt,
    body:
      fence(snippet.code, lang) + (snippet.note ? `\n\n${snippet.note}` : ""),
  };
}
