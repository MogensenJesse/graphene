## Learned User Preferences

- Never start the dev server; the user always does this manually
- Add a file path comment at the top of every source file (e.g. `// src/components/Sidebar.tsx`)
- Use Biome for linting/formatting — not ESLint or Prettier
- Prefer CSS variables + SCSS over Tailwind; no Tailwind dependency in this project
- Use Cascadia Code (not JetBrains Mono) as the monospace font
- No emojis in responses unless explicitly requested
- Prefer KISS, YAGNI, SOLID; propose incremental improvements and understand existing code first
- Always check available MCP servers and use them when relevant
- Read all files in the resources folder before initiating a conversation

## Learned Workspace Facts

- Project: Graphene (renamed FlowVault → Graphite → Graphene) — Tauri v2 + React 18 + TypeScript + Vite desktop app for general note-taking with markdown, folders, and code snippet storage; disk root: `D:\graphene`; Tauri identifier: `com.graphene.app`; GitHub: `MogensenJesse/graphene` (remote: `https://github.com/MogensenJesse/graphene.git`, renamed from `flowvault`)
- Stack: Tauri v2, React 18, TypeScript, Vite, SCSS, nanoid, Biome, gray-matter; plugins: tauri-plugin-fs + tauri-plugin-clipboard-manager + tauri-plugin-dialog
- Design language and SCSS system borrowed from `D:\image-optimizer` (React + JSX, no TypeScript — reference for styles only)
- SCSS color palette: `$light` #e0e0e0, `$night` #0E0E0F, `$onyx` #121314, `$green` #62cd20, `$yellow` #d7bb21, `$red` #cd3120; radii: `$radius-sm` 7px, `$radius-lg` 12px
- CSS custom properties layer introduced on top of SCSS vars for semantic tokens (`--color-background-primary`, `--color-text-tertiary`, etc.)
- Storage: file-based vault at user-chosen directory (config at `$APPDATA/graphene/config.json`); notes → `.md` with YAML frontmatter (gray-matter); snippets → native extensions (`.js`, `.css`, etc.) with `// @graphene {}` comment metadata; folders → OS directories; filenames: `{slug(title)}-{id}.{ext}`
- Window: transparent + acrylic effect, no decorations, 960×640 default, min 720×480, dev port 1420
- Fonts: Switzer (Medium + Bold) for UI; Cascadia Code for monospace code blocks
- Project-level skills installed: `tauri-v2`, `vercel-react-best-practices`
- Continual-learning plugin active; agents-memory-updater subagent maintains this file; transcripts stored under `d-graphene` Cursor project slug (graphene project folder)
- Tags system fully removed (TAG_COLORS, tags field on BaseItem, TagPill component, all related SCSS); NewItemPanel unified create/edit panel for notes and snippets; SnippetForm.tsx and NoteForm.tsx deleted; `getFolderPath()` in `src/lib/utils.ts`; `useClickOutside` hook; sidebar: items visible inside folders with folder icons; drag-and-drop reorder between folders; new item button at bottom; app starts with fresh empty new-item panel (title and folder optional, defaults: "untitled"/root)
- Custom FolderPicker uses role="menu"/role="menuitem" for a11y (not listbox/option); note/snippet headers: breadcrumb path, date `margin-left: auto`, bottom border; `UpdateItemFields` union type; react-markdown `REMARK_PLUGINS` must NOT use `as const` (causes TS4104); markdown formatting toolbar (edit mode only, inserts syntax); "preview" toggle button renders markdown; `cargo clean` required when project folder is moved or renamed

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **graphene** (619 symbols, 1132 relationships, 51 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/graphene/context` | Codebase overview, check index freshness |
| `gitnexus://repo/graphene/clusters` | All functional areas |
| `gitnexus://repo/graphene/processes` | All execution flows |
| `gitnexus://repo/graphene/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
