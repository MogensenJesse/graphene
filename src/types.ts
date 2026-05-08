// src/types.ts

export const LANGUAGES = [
  "JS",
  "CSS",
  "HTML",
  "JSON-LD",
  "Bash",
  "SCSS",
  "TS",
] as const;

// Language colour map
export const LANG_COLORS: Record<string, { bg: string; color: string }> = {
  JS: {
    bg: "var(--color-background-warning)",
    color: "var(--color-text-warning)",
  },
  CSS: { bg: "var(--color-background-info)", color: "var(--color-text-info)" },
  "JSON-LD": {
    bg: "var(--color-background-secondary)",
    color: "var(--color-text-secondary)",
  },
  HTML: {
    bg: "var(--color-background-danger)",
    color: "var(--color-text-danger)",
  },
  Bash: {
    bg: "var(--color-background-success)",
    color: "var(--color-text-success)",
  },
  SCSS: { bg: "var(--color-background-info)", color: "var(--color-text-info)" },
  TS: { bg: "var(--color-background-info)", color: "var(--color-text-info)" },
};

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

interface BaseItem {
  id: string;
  type: "note" | "snippet";
  title: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteItem extends BaseItem {
  type: "note";
  body: string;
}

export interface SnippetItem extends BaseItem {
  type: "snippet";
  lang: (typeof LANGUAGES)[number];
  code: string;
  note: string;
  copies: number;
}

export type Item = NoteItem | SnippetItem;

// Backward-compat alias for residual references
export type Snippet = SnippetItem;
