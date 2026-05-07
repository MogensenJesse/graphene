// src/types.ts

export interface Snippet {
  id: string;
  title: string;
  lang: (typeof LANGUAGES)[number];
  tags: string[];
  projects: string[];
  code: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  copies: number;
}

// Tag colour map — bg and color use CSS custom properties to stay in sync with theme
export const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  scroll: {
    bg: "var(--color-background-success)",
    color: "var(--color-text-success)",
  },
  gdpr: {
    bg: "var(--color-background-warning)",
    color: "var(--color-text-warning)",
  },
  maps: { bg: "var(--color-background-info)", color: "var(--color-text-info)" },
  seo: {
    bg: "var(--color-background-danger)",
    color: "var(--color-text-danger)",
  },
  cms: {
    bg: "var(--color-background-secondary)",
    color: "var(--color-text-secondary)",
  },
  webflow: {
    bg: "var(--color-background-secondary)",
    color: "var(--color-text-secondary)",
  },
  html: {
    bg: "var(--color-background-danger)",
    color: "var(--color-text-danger)",
  },
  css: { bg: "var(--color-background-info)", color: "var(--color-text-info)" },
  js: {
    bg: "var(--color-background-warning)",
    color: "var(--color-text-warning)",
  },
  animation: {
    bg: "var(--color-background-success)",
    color: "var(--color-text-success)",
  },
};

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

export const LANGUAGES = [
  "JS",
  "CSS",
  "HTML",
  "JSON-LD",
  "Bash",
  "SCSS",
  "TS",
] as const;
