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

- Project: FlowVault — Tauri v2 + React 18 + TypeScript + Vite desktop app for storing, tagging, and copying Webflow custom code snippets
- Stack: Tauri v2, React 18, TypeScript, Vite, SCSS, nanoid, Biome; plugins: tauri-plugin-fs + tauri-plugin-clipboard-manager
- Design language and SCSS system borrowed from `D:\image-optimizer` (React + JSX, no TypeScript — reference for styles only)
- SCSS color palette: `$light` #e0e0e0, `$night` #0E0E0F, `$onyx` #121314, `$green` #62cd20, `$yellow` #d7bb21, `$red` #cd3120; radii: `$radius-sm` 7px, `$radius-lg` 12px
- CSS custom properties layer introduced on top of SCSS vars for semantic tokens (`--color-background-primary`, `--color-text-tertiary`, etc.)
- Storage: flat `snippets.json` via `BaseDirectory.AppData`; no cloud sync
- Window: transparent + acrylic effect, no decorations, 960×640 default, min 720×480, dev port 1420
- Fonts: Switzer (Medium + Bold) for UI; Cascadia Code for monospace code blocks
- Project-level skills installed: `tauri-v2`, `vercel-react-best-practices`
- Continual-learning plugin active; agents-memory-updater subagent maintains this file
