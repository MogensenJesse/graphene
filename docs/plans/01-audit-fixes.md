# Audit fixes: UI, UX and performance

Status: plan, nothing implemented yet. Written 2026-11-21 from audits run on 2026-11-20 against v1.6.0.

Related plans: [02-android-app.md](02-android-app.md), [03-cloud-sync-and-collaboration.md](03-cloud-sync-and-collaboration.md).

## Context

Graphene (Tauri v2, React 19, TypeScript) just shipped a large batch: several vaults, Settings, the Tasks tab, the task details
pane and motion. Before building the next phase (an Android app and a paid sync tier) we audited what is there: visual consistency
(UI), user flows (UX), and startup and bottlenecks (performance).

How the audits were done: three read-only code reviews. Nothing was built or run, so every millisecond figure below is an estimate
until the first work package (WP0) measures it. The findings that drive the most work were spot-checked by hand and all held:

- There is no `memo(` and no `lazy(` anywhere in `src/`.
- `src-tauri/Cargo.toml` has no `[profile.release]`.
- There is no error boundary.
- `useDeleteConfirm` has no `e.repeat` guard and no open-modal guard.
- The window is never created hidden.
- 53 `console.error` / `console.warn` sites swallow write failures.
- `replaceItemFile` (`src/lib/storage.ts:193`) deletes the old file before it saves the new one.

## Decisions made

1. **Typography:** ship Switzer Regular (400) and SemiBold (600) in addition to Medium and Bold. Every existing weight declaration is
   mapped to the nearest shipped weight.
2. **Order of work:** UX safety first (WP0 and WP1), then design tokens and shared primitives, then the rest as listed below.
3. **Startup:** go straight to a Rust `scan_vault` command with lazily loaded note bodies (WP5), rather than JS-only fixes first. The
   cheap JS wins (memoisation, throttling, lazy dialogs) still happen in WP6.

## 1. UI audit

Already consistent, no action needed: no raw hex colours outside `_variables.scss`; shadows go through `--shadow-popover` and
`--shadow-modal`; `!important` appears only in the reduced-motion reset; `Modal` is shared by Search, Update and Settings;
`ContextMenu` also backs `MoreButton` and `VaultSwitcher`; `Tooltip` is one primitive; both themes are fully tokenised; the
`custom-scrollbar` mixin is on 12 of 13 scroll containers.

| # | Sev | Finding | Fix (reuse) | Effort |
|---|-----|---------|-------------|--------|
| U1 | High | Buttons are re-declared in about 10 places (`_UpdateDialog.scss:121`, `_Settings.scss:374`, `_VaultUnavailable.scss:39`, `.vault-picker__btn`, toast, folder-confirm). Icon buttons come in 4 sizes (22/24/26/32) and `.item-header__btn` is used outside the header. There is no `:active` state anywhere | New `ui/Button.tsx` and `ui/IconButton.tsx` backed by one `_Button.scss`; use the existing `--color-background-info` and `--color-border-danger`; delete the copies | M |
| U2 | High | No type-scale tokens: about 117 `font-size` declarations over 10 steps, including half-pixels (13.5, 12.5, 11.5), and 8 line-heights. Only Switzer 500 and 700 ship, so 400 renders as 500 and 600 as bold; selected-state `font-weight: 500` is invisible (`_Sidebar.scss:461`, `_TaskLists.scss:79`, `_Segments.scss:37`). The "+1px" change missed `.sidebar__nav-count` (11px), `.sidebar__brand`, the tab override at `_TaskLists.scss:108`, and the global `p { 14px }` beats `.update-dialog__markdown` | `--fs-xs/sm/md/lg/title` and `--fw-regular/medium/semibold/bold`; ship Regular and SemiBold in `public/fonts` with `@font-face` in `_typography.scss`; preload the weights used on first paint; put the `p { font-size: inherit }` fix into `markdown-prose` | M |
| U3 | High | Dropdown option hover is almost invisible in the dark theme (`color-mix(... 40%)` at `_ItemHeader.scss:349,356` and `_NoteEditor.scss:230`). Three different row styles exist (flush, 3px inset, 8px inset). `folder-picker__dropdown` and `code-language__dropdown` are near-duplicates | `@mixin popover-surface` and a shared `.menu-item` that uses `--color-background-active` | M |
| U4 | High | `Modal` shares the shell but not the structure: header and footer paddings are copy-pasted, there are 3 widths (620/580/560), 3 close styles, and the radius comes from an SCSS variable. There is no focus trap, no initial focus and no `inert` on `.app` (only Search focuses on open). Three different non-modal confirm patterns exist | `.modal__header/__title/__footer/__actions`, a shared `ConfirmBar`, and `inert` plus initial focus on open (also fixes X7) | M |
| U5 | Med | 15 of 19 `animation:` declarations use literal durations; `$panel-anim` duplicates `--ease-out`; Toast and Tooltip define their own keyframes and redundant reduced-motion blocks; `UndoToast` hardcodes `LEAVE_MS` | `--anim-pop` and `--anim-fade`; move all keyframes into `_motion.scss` | S |
| U6 | Med | 22 magic z-index values; the 52px bar height is hardcoded 6 times (plus 58 in `_FindBar`); `max-width: 720px` appears 6 times | `$z-*` map, `--bar-height`, `--column-width` | S |
| U7 | Med | Radius variables are mixed with `v.$radius-*` in about 12 places; `--border-radius-md` and `-row` are near-duplicates; pill and 50% radii have no token; odd 3/5/7/9px spacing appears 27 times | `--radius-lg`, `--radius-pill`, a small spacing scale | S |
| U8 | Med | `rgba(var(--rgb-blue), a)` appears 33 times with 11 different alphas; there is no `--color-border-info`; the only unthemed literal is `.app__scrim` (`_app.scss:97`, while `--surface-scrim` exists) | Add `--color-border-info`; replace the literals | S |
| U9 | Med | `--color-background-hover` is used both as a resting fill and as the selected style; 4 different disabled opacities; 37 copy-pasted focus-visible blocks (offsets 1/2/-1/-2/none); no focus style on the update pill, due-chip, folder-confirm button or dropdown options | `@mixin focus-ring($offset)`, `--color-background-field`, one disabled opacity | S |
| U10 | Med | Sidebar rows (`item-row`, `folder-row`, `task-list-row`, `nav-item`, `trash`) repeat the same hover, selected and drag-over blocks; 5 near-identical rename inputs; 3 checkbox looks; `.settings__chip` is a second "pressed" control next to `Segmented` | `@mixin row-surface`, a base `.inline-input`, one Checkbox, `Segmented` as the wrapper | M |
| U11 | Med | Scrollbar thumb contrast is about 1.2 to 1.4:1, there is no hover state, and the styling is WebKit-only; `.context-menu--sub` is missing the mixin | Thumb on `--color-border-primary`, a hover state, add the mixin | S |
| U12 | Low | Dead code: `.item-header__badge` and `--toggle` plus the `badge` prop, `settings__tabs`, a duplicate `__update-pill` block, `rgba($night, 0)`. `_Tasks.scss` (685 lines) holds 5 blocks. Three stray native `title=` attributes contradict AGENTS.md | Delete or split | S |
| U13 | Low | The update dialog's markdown follows the user's code font, although AGENTS.md says the chrome never does | Use `--font-mono` | S |
| U14 | Low | Fixed 252px sidebar and 320px pane; breakpoints written as literals in 2 units; 14 ellipsis triplets; 3 wrapping strategies; icon sizes 11 to 16 (13 vs 14 and 11 vs 12 are near-duplicates) | Mixins and tokens | S |

## 2. UX audit

Already solid: the context-menu engine, note trash with Undo, the search palette, drag cancel with Esc, vault switching (flush and
remount), the first-run picker and corrupt-config message, reduced motion, autosave with a flush on leaving, and the deliberate
Esc layering.

| # | Sev | Finding | Fix | Effort |
|---|-----|---------|-----|--------|
| X1 | High | **Disk failures are invisible.** Writes end in `console.error` or `console.warn`; the UI updates optimistically, the unsaved dot clears, and a "trashed" note reappears on the next rescan (`useItems.ts:34,60,72,118`, `storage.ts:237,258`, `useFolders.ts`; `useTasks.ts:86` reverts silently) | One `reportError` toast channel with Retry; keep the dirty flag until the write resolves | M |
| X2 | High | **Del on a folder** can delete with no real confirmation: `useDeleteConfirm.ts:39-49` has no `e.repeat` or modal guard, so a held Del or Del-Del deletes it. A folder also stays invisibly selected after a click or a delete, so Del stops trashing notes (`App.tsx:577`) | `e.repeat` and modal guard, clear the selection after a delete, arm only when the tree has focus | S |
| X3 | High | Folder delete flattens the tree (descendant folders are dropped, notes are hoisted, no Undo) and the banner only says "Items inside move up one level" (`useFolders.ts:100`, `FolderRow.tsx:230`) | Honest copy now; a snapshot Undo toast later | S, then M |
| X4 | High | Folder names are not validated: `/ \ : * ? " < > \|`, `..`, case-insensitive duplicates, and a leading "." (the folder and its notes vanish on the next rescan, `storage.ts:113`) are all accepted; renaming onto an existing name leaves the UI and the disk out of step | Validate in the `InlineInput` commit path with an inline error | S to M |
| X5 | High | Deleting a to-do list is permanent, the banner counts only open tasks while completed ones are deleted too (`TaskLists.tsx:273`, `useTasks.ts:234`), and "Delete group" has no confirmation | Count all tasks; reuse `UndoToast` with a list snapshot | S, then M |
| X6 | Med | Vault edge cases: start-up silently falls back to another vault (`useVaults.ts:97`); when a vault is unavailable the sidebar stays live (New note does nothing, "Add folder" recreates the root, `storage.ts:454`); there is no loading state, so "Nothing here yet" flashes | A notice naming the fallback vault, disable sidebar actions on failure, a loading state | S to M |
| X7 | Med | Modals have no focus management or trap, and F2 and the folder Del handler ignore open modals (same root cause as U4) | Fixed once in `Modal` | S |
| X8 | Med | F2 is handled twice (tree handler `Sidebar.tsx:300` and the global one `ItemHeader.tsx:43`); F2 renames the open note while a folder is the highlighted row | `stopPropagation`; F2 renames folders | S |
| X9 | Med | Trash is all-or-nothing: no per-note "Delete forever", no preview, restore gives no toast and silently falls back to the vault root, Esc does nothing | "Delete forever" with confirmation, a "Restored to X" toast, Esc to leave | M |
| X10 | Med | An outside edit loses to a dirty editor: autosave silently wins (`useVaultRefresh.ts:33`) | "Changed on disk: Keep mine / Reload", or write a `.conflict` copy | M |
| X11 | Med | Task title, note and step fields commit only on blur, so closing the window or pressing Ctrl+Shift+T with the caret in a task note can drop text; window close waits a fixed 200 ms (`App.tsx:831`) | Flush task fields on the same path as the editor; await the writes | S to M |
| X12 | Med | No error boundary: a render error leaves a transparent window with no controls, so it cannot even be closed | A root `ErrorBoundary` with Reload and the window controls | S |
| X13 | Med | Accessibility: every task checkbox and star has the same name; `role="tree"` wraps non-items; arrow keys skip folders and there are no expand or collapse keys; reordering and moving are pointer-only and folders cannot be re-parented; menu "checked" items lack `aria-checked`; the Undo toast has no Ctrl+Z and does not pause on hover | Task title in labels, Move up/down menu items, `aria-checked`, Ctrl+Z | M |
| X14 | Med | Esc cancels in `InlineInput` but commits in the task details pane; several bubble-phase handlers fire together | One rule plus `stopPropagation` | S |
| X15 | Low | "+" adds a subfolder on a folder row but "new note here" is menu-only; the Notes "+" means folder, the Tasks "+" means list and the folder-plus icon means group; a hidden sidebar leaves no visible New, Search or Settings; the task list header has no "..." menu; note rows have no hover action | Placement pass | S to M |
| X16 | Low | Switching tabs loses the sidebar scroll position; a note opened from search inside a collapsed folder is not revealed | Scroll into view, expand ancestors | S |
| X17 | Low | The file-drop overlay has no text; unsupported files are ignored silently; dropping in the Tasks tab imports notes and then switches tab | Copy and a toast | S |
| X18 | Low | Copy: "item" leaks into user text (`FolderRow.tsx:230`, `TrashView.tsx:26,59`, `aria-label="Edit item"`); "Add" vs "New"; "Mark as not done" vs "Not important"; "Show file" vs "Reveal in Explorer"; inconsistent ellipsis; README line 19 is stale | Terminology pass | S |

Context menus: all menus come from `ContextMenuProvider`, and destructive items are always last and styled `danger`. Gaps: no menu
shows shortcuts; the task menu has no Rename and "Due date" has no custom date; there is no "Copy path"; folders cannot be
re-parented from a menu; "Open details" does not focus the title (the keyboard path does); `VaultUnavailable` offers a "New note"
that does nothing.

## 3. Performance audit

Everything here is a hypothesis until WP0 measures it, unless marked verified.

Cold-start timeline:

1. **Rust (verified):** plugins initialise and `allow_vault_folders` parses `config.json` synchronously. The app registers no custom
   commands, so every file operation is a generic fs-plugin call from JS.
2. **Window (verified in config):** it is `transparent` with an acrylic effect and created visible, so the user sees an empty
   rectangle while WebView2 starts (estimate 100 to 400 ms).
3. **JS load (verified):** one chunk holding react-dom, react-markdown with remark-gfm and rehype-highlight (the `common` grammar
   set), plus Settings, Update and Search. About 105 KB of SCSS and two fonts with no preload. No `lazy()` or dynamic import.
4. **`main.tsx`:** theme and font prefs from localStorage; fine.
5. **`App` returns `null` until `vaults.ready` (verified):** three serial IPC calls (`exists(config)`, `readTextFile`, `exists(vault)`)
   for data Rust already parsed.
6. **`MainApp` mounts empty (verified):** the sidebar shows "Nothing here yet" for the whole load because there is no loading state.
7. **`loadVault` (`storage.ts:434`), where the time goes (verified):** the directory walk is serial; trash bodies are read serially
   on the critical path; then every note body is read (16 at a time) and parsed on the main thread, followed by one `setItems`. All
   bodies stay in the JS heap. Estimate: about 0.1 s at 500 notes, 0.5 to 2 s at 5k, 5 to 20 s at 50k.
8. **First populated render:** every row, no virtualisation, folders expanded by default (estimate 100 to 300 ms at 5k notes).
9. **+5 s:** the updater check toggles its status three times; `useVaults` returns a fresh object each render and `MainApp` is not
   memoised, so each toggle re-renders the whole tree.
10. **Every window focus:** a tasks rescan with no throttle, a per-vault `exists`, and a full vault re-read at most every 5 s.

| # | Sev | Bottleneck | Fix | Effort |
|---|-----|-----------|-----|--------|
| P1 | High | The load path blocks first paint on every body and the whole trash; serial directory walk; O(N) heap | Rust `scan_vault` returning metadata only in one IPC call, with lazy bodies (see WP5); quick wins first: parallel walk, trash off the critical path, chunked commit | S to L |
| P2 | High | The focus rescan re-reads and re-parses the whole vault | Use the Rust scan's mtime and size to read only changed files; later a `notify` watcher with debounce | M |
| P3 | High | God component and zero `memo`: about 3 renders per edit; note drag state lives in `Sidebar` and re-renders every row per frame; task drag state lives in `MainApp` | `memo` on `ItemRow`, `FolderRow`, `TaskRow`, `MainApp` with stable callbacks (`useLatest`); memoise the `useVaults` result; virtualise the tree above about 500 rows only if WP0 justifies it | M, or L |
| P4 | High | Large-note typing: `WordCount` runs a split, filter and regex pipeline per keystroke; `\r\n` is replaced twice and `findFenceAt` splits every line; Find lowercases the whole text per keystroke | Defer or debounce the word count, drop the redundant CRLF replace, scan for the fence near the caret | S |
| P5 | High | The read view renders the whole body and runs highlight.js synchronously (a multi-second freeze at 1 to 5 MB) | Render by top-level block in chunks with `content-visibility: auto`, or show raw text above a size threshold | M |
| P6 | Med | Blank acrylic window, then the "Nothing here yet" flash | `visible: false` and `show()` after first paint, plus a Sidebar `loading` state | S |
| P7 | Med | Config boot waterfall (3 serial IPC calls) | Expose the active vault at boot | S to M |
| P8 | Med | No code splitting; the `common` highlight grammar set | `lazy()` for Settings, Update and Search; dynamic-import the markdown pipeline; explicit `languages` | S to M |
| P9 | Med | Search has no index: it scans every note per keystroke, a WeakMap of lowercase bodies doubles memory, and an empty query sorts all N notes with `localeCompare` to take 12 | ISO string compare, top 12 in one pass, drop the double lowercase; later a Rust-side index | S, then L |
| P10 | Med | Autosave: a full rewrite plus a `mkdir` IPC per save, `setItems` is O(N) with a re-sort, the debounce has no max-wait (continuous typing never saves), note writes are not atomic | Skip `mkdir` for known directories, add a 5 to 10 s max-wait, temp-and-rename | S |
| P11 | Med | Tasks: 5 IPC calls per mutation, a pretty-printed whole-file write, an unthrottled focus reload, and `TasksPane` sorts and filters on every render | Throttle to 5 s, memoise lists, `memo(TaskRow)` | S to M |
| P12 | Med | `VaultImage` reads the whole file over IPC and copies it, with no cache across note switches; pasted images are stored at full size | Asset protocol, or an IntersectionObserver gate plus an LRU cache | S to M |
| P13 | Low | No `[profile.release]` | `lto`, `codegen-units = 1`, `opt-level = "s"`, `panic = "abort"`, `strip` | S |
| P14 | Low | Sidebar and pane collapse animate `width` and `margin-right` (a relayout of the main pane every frame); `backdrop-filter` on `.drag-ghost` | Solid background on the ghost; consider a transform-based slide | S to M |
| P15 | Low | Dev only: StrictMode runs the scan twice and `beforeDevCommand` runs `build:mcp` and `pack:mcpb` on every start | Do not profile cold start in dev | none |

What breaks first: at 5k notes, the unvirtualised first render, the focus rescan and about 3 renders per edit; at 50k notes, the
cold load (seconds, 0.3 to 1 GB of memory) and a DOM of roughly 400k nodes; with 1 to 5 MB notes, `WordCount` per keystroke and the
read-view freeze; with 1k+ tasks, row re-renders on every mutation and drag frame.

## 4. Work packages (order matters)

**WP0. Measure first (S).**
- A synthetic-vault generator script kept outside the shipped app: 1k, 5k, 20k and 50k notes of 2 to 8 KB in a folder tree, a few
  1 to 5 MB notes, 500 trashed notes, and 2k tasks.
- `performance.mark` and `measure` at: top of `main.tsx`, config ready, scan done, bodies read, items committed, first populated paint.
- A dev-only IPC call counter, a `long-animation-frame` observer, and `vitest bench` for `wordCount`, `findFenceAt` and `searchItems`.
- This gives a baseline, so P1 to P12 are decided by numbers.

**WP1. Safety and honest feedback (S to M, UX).**
- X2, X4, X3 (copy), X5 (copy), X12 (ErrorBoundary).
- X1: the `reportError` toast channel, with the dirty flag kept until the write resolves.
- X11: flush task fields and await writes on close.
- Data safety: `replaceItemFile` (`storage.ts:193`) must write the new file first and delete the old one after. Today a failed save
  after the delete loses the note.
- Data safety: `saveItem` must write through a temp file and a rename, using one helper shared with `mcp/vault.ts` (the MCP server
  already writes that way).

**WP2. Design tokens, no visual change (S to M, UI).** `--fs-*`, `--fw-*` (including the new Regular and SemiBold font files),
`$z-*`, `--bar-height`, `--column-width`, motion tokens, `--color-border-info`, radius and spacing tokens, the `focus-ring` mixin,
scrollbar contrast, dead-code removal, and the misses from the "+1px" change.

**WP3. Shared primitives (M, UI).** `popover-surface` and `.menu-item` (fixes the invisible dropdown hover), `row-surface`,
`ui/Button` and `IconButton`, a base `.inline-input`, one Checkbox, `Modal` header and footer plus `ConfirmBar`; then migrate the
dialogs, `VaultUnavailable`, `VaultPicker` and the toast.

**WP4. Modal focus and keyboard accessibility (S to M, UI and UX).** U4 and X7 once, in `Modal` (initial focus, Tab trap, `inert` on
`.app`); X8, X13, X14; shortcut hints in context menus; the task title in checkbox labels.

**WP5. Startup path (M to L, performance).**
- A `scan_vault(path)` command in `src-tauri/src/lib.rs` (the app registers no custom commands today, so this adds an
  `invoke_handler`). It walks the vault once with the same rules as `scanVaultRecursive` and `readItemFile` (skip dot folders,
  `attachments/` at the root, non-`.md` files, files without an id), parses frontmatter in Rust, and returns metadata only (id,
  title, folderId, created and edited dates, order, mtime, size, kind hint) in one IPC call. A `read_notes(paths)` command returns
  bodies in batches. The UI paints at metadata time and bodies stream in afterwards.
- Parity guard: the scan rules and the YAML-frontmatter subset must stay identical in `storage.ts`, `mcp/vault.ts` and Rust. Share
  fixtures (a `fixtures/vault` tree) consumed by both a Rust `#[test]` and the existing Vitest tests for `fileFormat` and
  `mcp/vault`, and update the AGENTS.md "Storage" and "MCP server" facts in the same change.
- Design consequence: `searchItems` (and the `search.ts` module the MCP server shares) scans `item.text`, so content search is
  incomplete until bodies are loaded. Load bodies in the background after first paint and show "Indexing..." in Ctrl+K until done;
  title search works immediately.
- Same package: P6 (window created hidden, shown after first paint, Sidebar `loading` state), P7, P8, P13, and the trash off the
  critical path (count only).
- The focus rescan (P2) uses the scan's mtime and size to read only changed files.
- Re-measure against the WP0 baseline after each step. The scan's metadata also becomes the input for the sync manifest described in
  [03-cloud-sync-and-collaboration.md](03-cloud-sync-and-collaboration.md), and the same Rust command serves the Android app
  ([02-android-app.md](02-android-app.md)).

**WP6. Render and typing hot paths (S to M, performance).** P4; P3 (`memo` and stable callbacks first, virtualise only if the WP0
numbers justify it); the quick search fixes from P9; P10; P11.

**WP7. Vault resilience, trash and undo (M, UX).** X6, X9, X10, Undo for folder and list deletes (the full X3 and X5), X16 to X18,
and the menu gaps (task Rename, a custom due date, Copy path, folder re-parenting through "Move to").

**WP8. Remaining bigger performance bets, only if the WP0 numbers still justify them (L).** A `notify` file watcher instead of the
focus rescan, a virtualised tree, a chunked read view (P5), and a Rust-side search index.

The feature work (Android app, accounts, sync, collaboration) is planned separately in documents 02 and 03 and starts after WP0 to
WP7.

## 5. Execution conventions (from CLAUDE.md and AGENTS.md)

- Before editing any function, class or method, run GitNexus impact (`node .gitnexus/run.cjs impact "<symbol>" --direction upstream --repo .`)
  and report callers and risk. Warn on HIGH or CRITICAL risk; treat `UNKNOWN` as unresolved, not as low. Before each commit run
  `detect-changes --scope all`. Use `rename`, never find-and-replace.
- A file-path comment goes at the top of every source file. Use Biome only: `npx biome format --write --line-ending=crlf <files>`
  (the working tree is CRLF). Use SCSS with CSS variables; no raw colours in components, so both themes keep working.
- Pure logic gets a Vitest test next to it, `npm test` must stay green, and AGENTS.md facts are updated in the same change.
- A user-facing change gets one plain-language line under `## Unreleased` in `CHANGELOG.md`. Never edit version numbers, and never
  tag or push a release unasked.
- Never start the dev server (the user does). Commit only when asked, in logical batches (one per work package or section). No pull
  request unless asked.

## 6. Verification

- Every work package: `npx tsc --noEmit`, `npm test`, `npx biome check <touched files>`, and GitNexus `detect-changes`.
- UI (WP2 to WP4): grep that no literal `font-size`, z-index or `rgba(var(--rgb-blue)` is left outside the token files; compare dark
  and light themes in `tauri dev` (the user runs it) for dropdown hover, buttons, modals and scrollbars; Tab through every modal to
  confirm the focus trap.
- UX (WP1 and WP7), manual scripts:
  - Hold Del on a selected folder.
  - Create folders named `a/b`, `.x` and duplicates.
  - Force a write to fail (read-only file or missing vault) and confirm the toast and the dirty flag.
  - Delete a list that has completed tasks, then Undo.
  - Close the window with the caret in a task note.
- Performance (WP5 and WP6): re-run the WP0 synthetic vaults before and after each change. Compare the marks (config ready, scan
  done, first populated paint), render counts in the React Profiler, and per-keystroke time on a 1 to 5 MB note. Put the numbers in
  the commit message.
