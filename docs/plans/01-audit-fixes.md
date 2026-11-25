# Audit fixes: UI, UX and performance

Status: written 2026-11-21 from audits run on 2026-11-20 against v1.6.0. Wave 1 (WP0 tooling, WP1, WP2), wave 2 (WP3, WP4, the
first half of WP5), wave 3 (WP6, WP7) and wave 4 (the small and medium items that were left) are implemented and not committed: `tsc`, `npm test` (339), `cargo test` (9 + 13) and Biome (`src`, `mcp`, `scripts`) are green. The
wave-2 build was driven in a release exe over CDP with no failing check ([00-wave-2-checks.md](00-wave-2-checks.md)); wave 3 was driven the
same way by hand against a synthetic 1k vault (below), and startup was measured again at 1k and 20k; wave 4 was driven the same way, and 20k startup
was measured once more.

Wave 2 (2026-11-22 to 24):
- WP3 shared primitives: `popover-surface`, `menu-item`, `row-surface`, `inline-field`, `ui/Button`, `IconButton`, `Checkbox`, `ConfirmBar`,
  the modal header and footer; the invisible dropdown hover is fixed (the hover wash was about 1 RGB level in dark). Left for later: the
  window controls, `SidebarToggle`, the sort button, `MarkdownToolbar` buttons, `.due-chip` and a few task-detail buttons still have their own rules (wave 4 moved them onto the shared buttons).
- WP4: `Modal` traps Tab, takes the initial focus, makes `.app` inert and gives the focus back; F2, shortcut hints in menus, task titles in checkbox
  labels, Move up/down in menus, Escape in a task field drops the typed text (behaviour change: it used to commit). Left: the sidebar tree
  is still not a proper tree (arrow keys skip folders, no expand/collapse keys; done in wave 4).
- WP5, done: Rust `scan_vault` / `read_notes` (metadata in one call, bodies in batches, guarded by `fixtures/vault` in Rust, mcp and fileFormat tests),
  the TypeScript load through them with lazy bodies (an unloaded note is never written: `writeItem` refuses it), the "Indexing..." hint, the
  trash read on demand, the focus rescan reading only changed files, `boot_config` (one call instead of three), the window created hidden and
  shown after the first scan (3 s Rust safety net), lazy chunks (entry 740 to 376 kB), the release profile (LTO, `opt-level = "s"`, abort, strip;
  exe 15.2 to 5.8 MB). Measured in [00-after-wave-2.md](00-after-wave-2.md): first paint 3.5 to 0.56 s at 1k, 8.1 to 0.85 s at 5k, 27.7 to 2.2 s at
  20k, 71 to 7.7 s at 50k.
- WP5, still open: the first render of every row is the remaining cost at 50k (5.6 s, 480k DOM nodes), each body batch re-renders the whole
  sidebar (8 long frames at 20k, 10 at 50k; WP6 `memo`), the heap is higher after loading from 5k up (637 MB at 50k, cause not investigated),
  the window now appears at 0.6 s at 1k (the old build showed an empty one at 60 ms), and the app's own writes are re-read once by the next
  rescan (stamps are not refreshed). A Rust listing of the trash would replace the 16-at-a-time reads (that and the own-writes re-read were done in wave 4).
- Found while checking, for WP7: while `VaultUnavailable` shows, the sidebar still offers New note and New folder, and a save would
  recreate the missing vault folder (`mkdir` recursive); guard those paths. Ctrl+Z straight after Del does nothing because the new draft's
  textarea takes the focus (the toast's Undo button works). The first focus rescan makes about 22 `exists` and 18 `read_text_file` calls for the
  task store (P11).

Wave 3 (2026-11-24):
- WP6, done: the sidebar, the folder and note rows, the note view and editor and the task rows are `memo`ised with `useStable` handlers (events
  only); the drag state lives in `lib/dragStore.ts`, so a drag frame renders only the folder under the pointer; the word count is deferred; a
  focus rescan runs at most every 5 s (`rescanGate`); a task-store write is 3 file calls instead of 5; `perfRender` / `perfRenders()` count
  renders (with `graphene.perf` on). Read in a release exe at 1k: selecting a note renders MainApp 1 to 2, Sidebar 1 to 2, each of the 50
  folder rows once, the note rows 1 to 2 and NoteDetail 2; a key in the editor renders NoteEditor twice and nothing else; the first key after a pause (the
  unsaved flag flips) and each autosave also render MainApp, Sidebar, the folder rows and one row once; a drag frame renders one folder row.
  Startup again, median of 3 launches, against wave 2: 1k window visible 574 ms (580), first paint 582 (557), `bodies-read` 834 (819); 20k window
  visible 2199 (2146), first paint 2054 (2185), `bodies-read` 5307 (5520). Long frames at 20k: 1 of 965 ms (was 8 of 1756 ms, and none between first paint
  and `bodies-read`), JS heap after loading 298 MB (was 526), renderer working set 906 MB (was 1172). 5k and 50k were not measured again.
- WP7, done: a write never makes a vault's own folder (`lib/vaultRoot.ts`; the message says "the vault folder is not there"), the fallback notice
  when the open vault is missing at start, the conflict bar (Keep mine / Load theirs; leaving with the question open keeps what was typed as a
  "(conflict copy)" note), the Trash (Delete forever, "Restored to ...", Escape goes back), Undo for deleting a folder, a list and a group, Move to
  for a folder (pictures are relinked by depth), Copy path, Move up / Move down, and the task menu (Rename, Pick a date...).
- Checked by hand in the built app (1k synthetic vault, over CDP): boot, perf counters, Move to (20 notes, every `folderId` and the picture link
  rewritten from `../../` to `../../../`), folder delete and Undo (19 notes, files byte for byte the same, `.folder-order.json` the same), list delete
  and Undo, the conflict bar in all three ways (the outside text stays on disk until a choice), a vault folder renamed while the app runs (nothing is
  recreated, saves work again when it is back), Trash (restore message, Delete forever asks, Escape order), Copy path, Pick a date... (the calendar
  opens beside the row), scroll position kept across the tabs, reveal from Search.
- Found and fixed in those checks: the first failed save after a vault vanished said only "Could not save" (the look at the folder came one write
  later; `writeItem` now looks at once). Rename and Open details in a task's menu never left the cursor in the title, for two reasons: the menu handed the
  focus back to the row after the choice (`ContextMenu` now leaves it where the choice put it) and the closed details pane was still `visibility: hidden`
  in the frame it opened in (`_TasksPane.scss`: opening is instant, closing keeps its delay). `.app__sidebar` in `_app.scss` has the same transition.
- Still open: conflict detection runs only when the window gets focus; the MCP server (`mcp/vault.ts`, `mcp/taskFsNode.ts`) can still make a missing
  vault folder; a vault that vanishes while it is open does not turn into `VaultUnavailable` (saves fail with the message above); "0 notes / Nothing
  here yet" still shows beside `VaultUnavailable`; the tree is not a proper `role=tree`; Delete forever on one note leaves its pictures until Empty trash;
  Ctrl+Z straight after Del does nothing (the draft takes the focus); every folder row renders once per select, save or unsaved flip (50 at 1k, not
  counted at 20k); deleting a folder of about 100 notes takes a couple of seconds (19 notes: 0.43 s); the list's file is still on disk while its Undo bar is up;
  choosing a date in the calendar was not driven (it is the browser's own popup), and drag by pointer onto the Tasks tab, `Move to` for a folder with
  unsaved edits and the 5k and 50k vaults were not tried. Virtualising the tree (WP8) was left out on purpose. (Wave 4 below closed most of this list:
the conflict poll, the MCP `mkdir`, a vault that vanishes while open, "0 notes", the tree role, Delete forever's pictures and Ctrl+Z after Del.)

Wave 4 (2026-11-25), the small and medium items that were left:
- Buttons (WP3 leftovers): the window controls, `SidebarToggle`, the sort button, the Markdown toolbar, `.due-chip` and the task-detail and Add a task
  buttons are `IconButton` / `Button` (variants `tool` and `danger`, `aria-disabled`), so they press and focus alike; `.app__win-btn` is gone.
- The sidebar tree (WP4 leftover, X15): `role="tree"` with the arrow keys, Right / Left and Home / End (`lib/treeNav.ts`); the menu key opens the
  highlighted folder's menu; a folder's "+" offers a new note, new code or subfolder; note rows have a hover "..." with the row's menu; the Tasks
  list heading has a "..." menu (`listMenu`); Search, New and Settings stay beside the toggle while the sidebar is hidden. The first version put the
  button in every row: at 20k that was 292k DOM nodes, window visible 2678 ms and first paint 2749 ms (against 192k, 2199 and 2054), so `ItemRow`
  mounts it on the row's first `pointerenter` and a pseudo-element keeps its width. Measured again, median of 3 at 20k: 192,261 nodes, visible 2112
  ms, first paint 2033, `bodies-read` 4963, JS heap 305 MB, so the cost is gone (1k: 9,500 nodes at rest, 14,855 with the button in every row).
- Vault safety (WP7 leftovers): a vault that vanishes while it is open is noticed by the rescan (`lib/vaultGone.ts`): with nothing unsaved the app shows
  `VaultUnavailable` and loads the vault by itself once the folder is back, with unsaved text `VaultMissingBar` goes over the working app, keeps the
  editor and retries every 3 s; the MCP server refuses to make a missing vault folder (`requireVault`); the sidebar no longer says "0 notes"; the open
  note's file is looked at every 3 s (`lib/noteStamp.ts`, capability `fs:allow-stat`), so the conflict bar no longer waits for a focus; the app's own
  writes restamp the file, so the next rescan reads nothing of ours; the trash is listed by Rust `scan_trash` (no texts, read on restore); Delete forever
  removes the pictures only that note used (`ownImagesIn`).
- Save paths (WP1 leftovers): closing, the updater and a vault switch, add or remove flush first and are held back once when a note or task could not be
  saved (`lib/leaveGate.ts`); a failed task write keeps the window open once; the update does not install over unsaved text.
- Images: pictures load when they are within 600 px of the view and come from an LRU cache (64 pictures, 64 MB); a pasted or dropped PNG, JPEG or WebP
  over 2000 px is scaled down (a 4000 x 3000 PNG of 5.4 MB became 843 KB).
- Small: Ctrl+Z straight after Del works (an untouched draft's textarea is `data-pristine`); the search palette's lower-cased copies of the notes are
  dropped 30 s after it closes (they were kept for the whole session).
- Checked by hand in the built app (1k synthetic vault over CDP, 20k for startup): the tree keys, the folder "+", the row "..." (both themes), the header
  actions with the sidebar hidden, the list heading menu, Ctrl+Z after Del, the 3 s outside-edit poll, picture loading, Delete forever (only the
  app-named, unused pictures went), the trash list and a restore, paste scaling, a vault renamed away and back with nothing unsaved and with unsaved
  text (the bar stayed, the text was saved after the folder came back), a vault switch and a window close with a failing save (held back once, let
  through the second time), and rescans after our own save (one `scan_vault`, no `read_notes`) and after an outside edit (one `read_notes`).
- Still open: the image cache is keyed by path only (a file replaced under the same name keeps its old picture until a restart; the stat is allowed now
  but would cost a call per picture), and an animated WebP over 2000 px becomes one frame; the poll cannot see an outside write that keeps the same time
  and size; `useTasks` of a vault that vanished may read as no tasks while the bar shows; `.app__sidebar` has the same hidden-visibility transition the
  task details pane had (P14: sidebar width animation); the update dialog's unsaved-text hold was not driven (no update was available); a theme pass
  by eye over the snapped sizes and tints in both themes is still the user's; 5k and 50k startup were not measured again. Left out on purpose: the first
  render of every row (480k nodes at 50k), a virtualised tree, a chunked read view (P5) and a Rust search index (WP8).

Left open from wave 1:
- WP0: the startup baseline is measured, in [00-baseline.md](00-baseline.md) (release build, 1k to 50k notes: 3.5 s to first paint at 1k, 8.1 s at 5k, 27.7 s at 20k, 71 s at 50k; reading the note bodies is 40 to 82% of it); the `wordCount` bench waits for its extraction (WP6).
- WP1: closed in a follow-up: a failed save at window close keeps the window open once per run, the focus rescan keeps a note whose write
  failed, a failed trash drops its Undo toast, "Delete group" asks first. Still open: the "Add a step" and "Add a task" boxes commit on
  Enter only (left on purpose); failed task writes do not keep the window open; the updater install proceeds past a failed note; a vault
  switch drops the list of unsaved notes (those three were closed in wave 4); `writeQueue` (per note) overlaps the serial `tracked` queue and may be simplified.
- WP2: the Switzer Regular and SemiBold files are now in `public/fonts` (converted from the user's OTFs) with their `@font-face` and
  preloads, so 400 and 600 render for real: the UI is visibly lighter where it declared 400. U11: the bar is now a thin custom one (6px wide; on the panes that scroll up and down `lib/scrollbars.ts` draws a faint 3px thumb that grows to 6px under the pointer, since a native thumb cannot animate) with a reserved gutter (`scrollbar-gutter: stable`), so nothing shifts and it can be grabbed; WebView2's `fluentOverlay`
  style was tried and dropped because it fades after about a second and cannot be grabbed. The
  `799px` sidebar breakpoint in `App.tsx` remains, and the snapped values (font sizes, gaps, tints) and the new weights and
  scrollbars have not been looked at in both themes.

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
