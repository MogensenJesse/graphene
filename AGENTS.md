
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
- Stack: Tauri v2 (plugins: fs, clipboard-manager, dialog, opener, updater, window-state, single-instance), React 19, TypeScript 7, Vite 8, SCSS + CSS custom properties, nanoid, react-markdown (remark-gfm, remark-breaks, rehype-highlight), Biome 2. Frontmatter is parsed by a small parser in `src/lib/fileFormat.ts` (no gray-matter)
- Design language and SCSS system borrowed from `D:\image-optimizer` (React + JSX, no TypeScript — reference for styles only)
- Palette in `src/assets/styles/base/_variables.scss` (pastel, cool): `$light` #c8ccd6, `$night` #0c0d10, `$onyx` #0f1013, `$green` #96dfa8, `$yellow` #e8cf82, `$red` #e8909a, `$blue` #89b8e8; radii `$radius-sm` 3px, `$radius-md` 7px, `$radius-lg` 12px, plus `--border-radius-row` 8px. Components use the semantic tokens (`--color-background-primary`, `--color-text-tertiary`, `--color-background-hover`, …), not the raw SCSS colors. These are the dark theme's values; see Themes below
- Themes: `:root` holds the dark tokens and `:root[data-theme="light"]` (same file) overrides them; `src/hooks/useTheme.ts` sets `data-theme` on `<html>` (popups live outside `.app`) and calls the window's `setTheme` so the acrylic backdrop and native scrollbars follow. The choice is in `localStorage` (`graphene.theme`: system, light, dark) and applied in `main.tsx` before the first render. Never put a raw colour in a component's SCSS: tint overlays, scrims, shadows and danger/blue tints are tokens (`--surface-*`, `--shadow-*`, `--rgb-danger`, `--rgb-blue`). The light text colours were checked at 4.5:1 against both paper surfaces; recheck when changing a token. Pasting any new colour that is not a token breaks one of the two themes
- Icons are Lucide (ISC) copied as inline SVG into `src/components/Icon.tsx`, each marked `// lucide: name`; no icon package is bundled
- Data model (`src/types.ts`): one `Item` type, a markdown note. The kind is derived from the text, never stored (`itemKind` in `src/lib/utils.ts`): "code" starts with a fenced block, "todo" has a task (`- [ ]`) as its first line after blank lines and headings, else "note". The sidebar filter, icon and counts follow that
- Tasks (`src/lib/tasks.ts`, pure): the read view's checkboxes (`src/components/TaskList.tsx`, `NOTE_COMPONENTS`) work by the text offset react-markdown reports for the task's `<li>` (`toggleTaskAt`, `moveTask`), which `App` applies to the item body; never count the Nth checkbox, a fenced `- [ ]` would shift it. `UpdateDialog` keeps the inert `MARKDOWN_COMPONENTS`. Due dates are the todo.txt form `due:YYYY-MM-DD`
- Storage: file-based vault at a user-chosen folder (config at `AppData/graphene/config.json` through Tauri `BaseDirectory.AppData`). Every item is a `.md` file with YAML frontmatter named `{slug(title)}-{id}.md`; folders are real directories and a folder id is its path relative to the vault; deleted items move to the hidden `<vault>/.trash` (dot folders are ignored by the scan); old snippet files are converted to notes on first launch
- Window: transparent + acrylic, no decorations (custom `WindowControls`), 1366×768 default, min 800×540 (size, position and maximized state are restored by `tauri-plugin-window-state`; a second launch focuses the first window through `tauri-plugin-single-instance`, which must stay the first plugin in `lib.rs`), dev port 1420. The item header is one 52px bar with the window controls laid over its right end; draggable areas use `data-tauri-drag-region`, interactive items inside them need `no-drag` and a z-index above the drag strip
- Fonts: Switzer (Medium + Bold, in `public/fonts`) for UI; Cascadia Code for code
- Shared UI: `Modal` (search palette on Ctrl+K, update dialog), `ContextMenu`, `FolderPicker`, `Tooltip` (styled tooltip for one icon button, portalled to the body; only the editor toolbar uses it, other buttons keep native `title`s). Modals set `aria-modal`, and the global shortcuts in `useKeyboardShortcuts` stand down while one is open. Escape handlers for popups run in the capture phase and stop propagation so an open editor does not also close
- Search (`src/lib/search.ts`, pure): `parseQuery` / `searchItems` rank title hits over text hits and give highlights and a snippet; the sidebar's type filter is `filterByType`. Find in note (Ctrl+F) is `src/hooks/useFind.ts`: the read view paints matches with the CSS Custom Highlight API, the editor selects the current match; `App` raises `findSignal` on each press and the open `NoteDetail` or `NewItemPanel` shows its `FindBar`
- Outside edits: `App` rescans the vault when the window gets focus (at most every 5 s; `refreshFromDisk`) and applies it with `mergeItems` / `mergeFolders` (`src/lib/mergeScan.ts`, pure). Every vault write in `src/lib/storage.ts` goes through `tracked`, and a scan that overlapped one (`writeState` changed) is discarded and retried once, since it can catch a file mid-rename. The open editor copies its note at mount and autosaves, so the merge leaves a dirty editor's note alone and remounts a clean one (`draft.key`); never apply a scan to the editor's note otherwise
- Images: pasted or dropped pictures are saved by `saveImage` (`src/lib/attachmentStore.ts`) into `<vault>/attachments/` and linked relative to the note (`attachmentLink`, `src/lib/attachments.ts`, pure). The scan skips that folder at the vault root and `isReservedFolderName` keeps folders from using the name. The read view's `VaultImage` resolves any `.../attachments/<file>` link by file name (so a stale `../` count still shows) and loads it with `readFile` into a blob URL; there is no asset protocol. `updateItem` / `moveItem` rewrite the `../` depth when a note changes folder depth (`relinkAttachments`). Unused images are deleted only by `sweepUnusedImages` (`storage.ts`), which `useItems.emptyTrash` runs after the trash files are gone: it reads every `.md` in the vault and `.trash` (`readAllNotesText`, throws on any unreadable path so nothing is deleted), and `unusedImages` (pure) picks the files named like `saveImage` names them (`[\w-]{10}.<image ext>`) that no note text mentions by file name; it also skips when a write of ours ran during the scan (`writeState`)
- Right-click: `ContextMenuProvider` (mounted in `App`) owns the one menu and blocks the webview's own. A surface builds `MenuEntry[]` in its `onContextMenu` and calls `useContextMenu().open(e, entries)`, which stops the event; text fields are skipped there and get `textFieldEntries` (`src/lib/textMenu.ts`) from the provider's fallback, with `keepFocus` so the field is not blurred (a blur commits renames). The editor adds a Format submenu through `openText`. Never leave a right-click to the native menu
- Editor undo: the body textarea is React-controlled, so assigning its value (`setBody`) wipes the browser's undo stack. Edit it only through `replaceText` in `src/hooks/useMarkdownFormat.ts` (`execCommand`, keeps undo). The format rules live in `src/lib/markdownFormat.ts` (`formatText`, pure)
- Drag and drop: `useDragToFolder` (pointer events). The Trash button is a drop target through `data-folder-drop-id={TRASH_DROP_ID}`; the Sidebar turns that drop into a delete, never a move
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
