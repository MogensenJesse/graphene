// src/lib/fileFormat.ts
import type { NoteItem, SnippetItem } from "../types";

// ---------------------------------------------------------------------------
// Extension / language maps
// ---------------------------------------------------------------------------

const EXT_FOR_LANG: Record<string, string> = {
  JS: ".js",
  TS: ".ts",
  CSS: ".css",
  SCSS: ".scss",
  HTML: ".html",
  Bash: ".sh",
  "JSON-LD": ".md", // JSON has no comment syntax — stored as .md with lang in frontmatter
};

const LANG_FROM_EXT: Record<string, string> = {
  ".js": "JS",
  ".ts": "TS",
  ".css": "CSS",
  ".scss": "SCSS",
  ".html": "HTML",
  ".sh": "Bash",
};

export function extForLang(lang: string): string {
  return EXT_FOR_LANG[lang] ?? ".txt";
}

export function langFromExt(ext: string): string | null {
  return LANG_FROM_EXT[ext] ?? null;
}

// ---------------------------------------------------------------------------
// Notes — YAML frontmatter + markdown body
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

export function parseNoteFile(raw: string): NoteItem & { body: string } {
  const withoutBom = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;
  const fenceEnd = withoutBom.indexOf("\n---", 4);
  if (withoutBom.startsWith("---\n") && fenceEnd !== -1) {
    const frontmatterBlock = withoutBom.slice(4, fenceEnd);
    const body = withoutBom.slice(fenceEnd + 4).replace(/^\n/, "");
    const meta = parseYamlFrontmatter(frontmatterBlock);
    return {
      id: meta.id ?? "",
      type: "note",
      title: meta.title ?? "",
      folderId: meta.folderId && meta.folderId !== "null" ? meta.folderId : null,
      createdAt: meta.createdAt ?? new Date().toISOString(),
      updatedAt: meta.updatedAt ?? new Date().toISOString(),
      body,
    };
  }
  // Fallback: no frontmatter — treat whole file as body
  return {
    id: "",
    type: "note",
    title: "",
    folderId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    body: withoutBom,
  };
}

export function serializeNote(item: NoteItem): string {
  const folderLine =
    item.folderId !== null ? `folderId: ${item.folderId}` : "folderId: null";
  return [
    "---",
    `id: ${item.id}`,
    "type: note",
    `title: ${item.title}`,
    folderLine,
    `createdAt: ${item.createdAt}`,
    `updatedAt: ${item.updatedAt}`,
    "---",
    item.body,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Snippets — metadata JSON comment on line 1
// ---------------------------------------------------------------------------

interface SnippetMeta {
  id: string;
  type: "snippet";
  title: string;
  folderId: string | null;
  lang: string;
  copies: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

const PREFIX = "@graphene:";

function metaCommentForExt(
  ext: string,
  json: string,
): { line: string; closingTag: string } {
  if (ext === ".css" || ext === ".scss") {
    return { line: `/* ${PREFIX}${json} */`, closingTag: "" };
  }
  if (ext === ".html") {
    return { line: `<!-- ${PREFIX}${json} -->`, closingTag: "" };
  }
  // JS, TS, Bash, and catch-all
  return { line: `// ${PREFIX}${json}`, closingTag: "" };
}

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

export function parseSnippetFile(raw: string, ext: string): SnippetItem {
  const lines = raw.split("\n");
  const firstLine = lines[0] ?? "";
  const jsonStr = extractMetaJson(firstLine);

  if (jsonStr) {
    try {
      const meta = JSON.parse(jsonStr) as SnippetMeta;
      const code = lines.slice(1).join("\n").replace(/^\n/, "");
      return {
        id: meta.id ?? "",
        type: "snippet",
        title: meta.title ?? "",
        folderId: meta.folderId ?? null,
        lang: (meta.lang as SnippetItem["lang"]) ?? langFromExt(ext) ?? "JS",
        copies: typeof meta.copies === "number" ? meta.copies : 0,
        note: meta.note ?? "",
        createdAt: meta.createdAt ?? new Date().toISOString(),
        updatedAt: meta.updatedAt ?? new Date().toISOString(),
        code,
      };
    } catch {
      // Fall through to raw fallback
    }
  }

  // Fallback: no valid metadata comment
  return {
    id: "",
    type: "snippet",
    title: "",
    folderId: null,
    lang: (langFromExt(ext) as SnippetItem["lang"]) ?? "JS",
    copies: 0,
    note: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    code: raw,
  };
}

export function serializeSnippet(item: SnippetItem): string {
  const ext = extForLang(item.lang);
  const meta: SnippetMeta = {
    id: item.id,
    type: "snippet",
    title: item.title,
    folderId: item.folderId,
    lang: item.lang,
    copies: item.copies,
    note: item.note,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
  const json = JSON.stringify(meta);
  const { line } = metaCommentForExt(ext, json);
  return `${line}\n${item.code}`;
}
