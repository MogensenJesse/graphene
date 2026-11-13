
## Learned User Preferences

- Never start the dev server; the user always does this manually
- Add a file path comment at the top of every source file (e.g. `// src/components/Sidebar.tsx`)
- Use Biome for linting/formatting — not ESLint or Prettier. The working tree is CRLF, so format touched files with `npx biome format --write --line-ending=crlf <files>`
- Prefer CSS variables + SCSS over Tailwind; no Tailwind dependency in this project
- Use Cascadia Code (not JetBrains Mono) as the monospace font
- No emojis in responses unless explicitly requested
- Prefer KISS, YAGNI, SOLID; propose incremental improvements and understand existing code first
- Always check available MCP servers and use them when relevant
- Commit only when asked, in logical batches (one commit per feature or section)
- Keep this file in step with the code: when a change makes a fact here wrong (stack, window, storage, shortcuts, release flow), fix that line in the same change. It is edited by hand

## Releases and changelog

- The changelog is written for the people using the app, not for developers: one short line per change, in plain language about what they see or can now do. No file, function or library names. The same text is shown in the GitHub release and in the app's update dialog
- Sections, in this order, with empty ones left out: `### New`, `### Changed`, `### Fixes`, `### Other`. Keep a release to a handful of lines; merge small tweaks into one line
- Add lines under `## Unreleased` at the top of `CHANGELOG.md` in the same change that ships the feature or fix, not at release time. The section heading is just `## vX.Y.Z` (no title, no date) once released
- Never edit version numbers by hand. Versions follow semver: patch = fixes only, minor = anything new, major = a change that breaks existing vaults
- To release, and only when the user asks: `npm version patch|minor|major` (or an exact number), then `git push --follow-tags`, then publish the draft release on GitHub. `npm version` (via `scripts/release.mjs`) checks the changelog format, bumps `package.json` and `src-tauri`, turns `## Unreleased` into `## vX.Y.Z`, commits "Release vX.Y.Z" and tags it. Never tag or push unasked
- `.github/workflows/release.yml` builds the signed Windows installer on a `v*` tag and opens a draft release whose notes are that CHANGELOG section. Installed apps only see published releases

## Learned Workspace Facts

- Project: Graphene (renamed FlowVault → Graphite → Graphene) — a Tauri v2 desktop app for markdown notes with code blocks, nested folders and a trash; disk root: `D:\graphene`; Tauri identifier: `com.graphene.app`; GitHub: `MogensenJesse/graphene` (remote: `https://github.com/MogensenJesse/graphene.git`)
- Stack: Tauri v2 (plugins: fs, clipboard-manager, dialog, opener, updater), React 19, TypeScript 7, Vite 8, SCSS + CSS custom properties, nanoid, react-markdown (remark-gfm, remark-breaks, rehype-highlight), Biome 2. Frontmatter is parsed by a small parser in `src/lib/fileFormat.ts` (no gray-matter)
- Design language and SCSS system borrowed from `D:\image-optimizer` (React + JSX, no TypeScript — reference for styles only)
- Palette in `src/assets/styles/base/_variables.scss` (pastel, cool): `$light` #c8ccd6, `$night` #0c0d10, `$onyx` #0f1013, `$green` #96dfa8, `$yellow` #e8cf82, `$red` #e8909a, `$blue` #89b8e8; radii `$radius-sm` 3px, `$radius-md` 7px, `$radius-lg` 12px, plus `--border-radius-row` 8px. Components use the semantic tokens (`--color-background-primary`, `--color-text-tertiary`, `--color-background-hover`, …), not the raw SCSS colors
- Icons are Lucide (ISC) copied as inline SVG into `src/components/Icon.tsx`, each marked `// lucide: name`; no icon package is bundled
- Data model (`src/types.ts`): one `Item` type, a markdown note. A "code item" is a note whose body starts with a fenced block (`isCodeItem` in `src/lib/utils.ts`); the sidebar's Code filter and icon follow that
- Storage: file-based vault at a user-chosen folder (config at `AppData/graphene/config.json` through Tauri `BaseDirectory.AppData`). Every item is a `.md` file with YAML frontmatter named `{slug(title)}-{id}.md`; folders are real directories and a folder id is its path relative to the vault; deleted items move to the hidden `<vault>/.trash` (dot folders are ignored by the scan); old snippet files are converted to notes on first launch
- Window: transparent + acrylic, no decorations (custom `WindowControls`), 1366×768 default, min 800×540, dev port 1420. The item header is one 52px bar with the window controls laid over its right end; draggable areas use `data-tauri-drag-region`, interactive items inside them need `no-drag` and a z-index above the drag strip
- Fonts: Switzer (Medium + Bold, in `public/fonts`) for UI; Cascadia Code for code
- Shared UI: `Modal` (search palette on Ctrl+K, update dialog), `ContextMenu` (sidebar right-click menus, built in `Sidebar` and `FolderRow`), `FolderPicker`. Modals set `aria-modal`, and the global shortcuts in `useKeyboardShortcuts` stand down while one is open. Escape handlers for popups run in the capture phase and stop propagation so an open editor does not also close
- Updater: `tauri-plugin-updater` + `src/hooks/useUpdater.ts` (checks about 5s after launch, never in dev builds; the user installs from `UpdateDialog`). Windows only (NSIS, passive install). Endpoint is `latest.json` on the GitHub releases. The private signing key lives outside the repo in `%USERPROFILE%\.tauri\`; CI uses the secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; the public key is in `tauri.conf.json`
- Version: `package.json` is the single source (`tauri.conf.json` reads it); `src-tauri/Cargo.toml` and `Cargo.lock` are synced by `scripts/release.mjs`
- Gotchas: react-markdown `REMARK_PLUGINS` must NOT use `as const` (TS4104); TypeScript 7 needs `"types": ["vite/client"]`; `cargo clean` is required when the project folder is moved or renamed; a local `tauri build` needs `TAURI_SIGNING_PRIVATE_KEY` set because updater files are signed
- Project-level skills live in `.agents/skills` (not tracked by git; `skills-lock.json` lists them): `tauri-v2`, `vercel-react-best-practices`, `react-performance-optimization`, `code-review-and-quality`; the `gitnexus-*` skills are in `.claude/skills`

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
