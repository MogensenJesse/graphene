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
  // A CRLF file (an external Windows editor, git autocrlf) must parse like an LF one, or it has no id and vanishes
  const text = withoutBom.replace(/\r\n/g, "\n");
  const fenceEnd = text.indexOf("\n---", 4);
  if (text.startsWith("---\n") && fenceEnd !== -1) {
    const frontmatterBlock = text.slice(4, fenceEnd);
    const body = text.slice(fenceEnd + 4).replace(/^\n/, "");
    const meta = parseYamlFrontmatter(frontmatterBlock);
    const order = meta.order ? Number(meta.order) : Number.NaN;
    return {
      id: meta.id ?? "",
      title: meta.title ?? "",
      folderId:
        meta.folderId && meta.folderId !== "null" ? meta.folderId : null,
      createdAt: meta.createdAt ?? new Date().toISOString(),
      updatedAt: meta.updatedAt ?? new Date().toISOString(),
      ...(Number.isFinite(order) ? { order } : {}),
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
    body: text,
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
    ...(item.order !== undefined ? [`order: ${item.order}`] : []),
    "---",
    item.body,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Code blocks
// ---------------------------------------------------------------------------

/** Extensions of code files that can be dropped in. */
export const CODE_EXTS = new Set(["js", "ts", "css", "scss", "html", "sh"]);

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
