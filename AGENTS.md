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

<<<<<<< Updated upstream
- Project: FlowVault — Tauri v2 + React 18 + TypeScript + Vite desktop app for storing, tagging, and copying Webflow custom code snippets
- Stack: Tauri v2, React 18, TypeScript, Vite, SCSS, nanoid, Biome; plugins: tauri-plugin-fs + tauri-plugin-clipboard-manager
=======
- Project: Graphene (renamed FlowVault → Graphite → Graphene) — Tauri v2 + React 18 + TypeScript + Vite desktop app for general note-taking with markdown, folders, and code snippet storage; disk root: `D:\graphene`; Tauri identifier: `com.graphene.app`
- Stack: Tauri v2, React 18, TypeScript, Vite, SCSS, nanoid, Biome, gray-matter; plugins: tauri-plugin-fs + tauri-plugin-clipboard-manager + tauri-plugin-dialog
>>>>>>> Stashed changes
- Design language and SCSS system borrowed from `D:\image-optimizer` (React + JSX, no TypeScript — reference for styles only)
- SCSS color palette: `$light` #e0e0e0, `$night` #0E0E0F, `$onyx` #121314, `$green` #62cd20, `$yellow` #d7bb21, `$red` #cd3120; radii: `$radius-sm` 7px, `$radius-lg` 12px
- CSS custom properties layer introduced on top of SCSS vars for semantic tokens (`--color-background-primary`, `--color-text-tertiary`, etc.)
- Storage: file-based vault at user-chosen directory (config at `$APPDATA/graphene/config.json`); notes → `.md` with YAML frontmatter (gray-matter); snippets → native extensions (`.js`, `.css`, etc.) with `// @graphene {}` comment metadata; folders → OS directories; filenames: `{slug(title)}-{id}.{ext}`
- Window: transparent + acrylic effect, no decorations, 960×640 default, min 720×480, dev port 1420
- Fonts: Switzer (Medium + Bold) for UI; Cascadia Code for monospace code blocks
- Project-level skills installed: `tauri-v2`, `vercel-react-best-practices`
<<<<<<< Updated upstream
- Continual-learning plugin active; agents-memory-updater subagent maintains this file
=======
- Continual-learning plugin active; agents-memory-updater subagent maintains this file; transcripts stored under `d-flowvault` Cursor project slug (not `d-graphene`)
- Tags system fully removed (TAG_COLORS, tags field on BaseItem, TagPill component, all related SCSS); NewItemPanel unified create/edit panel for notes and snippets; SnippetForm.tsx and NoteForm.tsx deleted; `getFolderPath()` in `src/lib/utils.ts`; `useClickOutside` hook; sidebar: items visible inside folders with folder icons; drag-and-drop reorder between folders; new item button at bottom; app starts with fresh empty new-item panel (title and folder optional, defaults: "untitled"/root)
- Custom FolderPicker uses role="menu"/role="menuitem" for a11y (not listbox/option); note/snippet headers: breadcrumb path, date `margin-left: auto`, bottom border; `UpdateItemFields` union type; react-markdown `REMARK_PLUGINS` must NOT use `as const` (causes TS4104); markdown formatting toolbar (edit mode only, inserts syntax); "preview" toggle button renders markdown; `cargo clean` required when project folder is moved or renamed
>>>>>>> Stashed changes
