# Wave 2 checks on the built app

Status: run on 2026-11-23 and 2026-11-24 against the built release exe `src-tauri/target/release/graphene.exe` (page `http://tauri.localhost/`), driven over the
Chrome DevTools Protocol. The run was read-only for the repository: no source file was changed, nothing was rebuilt, no dev server was started. The
method of [00-baseline.md](00-baseline.md) (steps 1 to 6) is the base; the startup numbers of the wave are in [00-after-wave-2.md](00-after-wave-2.md).

Result in one line: 9 checks, 8 PASS and 1 PASS with one part NOT TESTABLE (the app swap through "Add vault..." needs the native folder picker). No check
failed. There are 9 oddities, none of them a data-loss or a safety problem, listed below with evidence and a best guess of the cause.

## Method

- Every launch used a temporary WebView2 profile (`WEBVIEW2_USER_DATA_FOLDER=C:\gv\wv2profile`) and
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222 --disable-features=CalculateNativeWinOcclusion --disable-backgrounding-occluded-windows --disable-renderer-backgrounding"`.
  The real profile `%LOCALAPPDATA%\com.graphene.app\EBWebView` and the real vault were never touched.
- The app was pointed at synthetic vaults (`scripts/gen-synthetic-vault.mjs`) through `graphene\config.json` (`{ active, vaultPath, vaults: [{ path, name, shared: true }] }`):
  `C:\gv\e1-1k` (1k preset: 1000 notes, 500 trashed notes, tasks), `C:\gv\e1-20k` (20k preset) and `C:\gv\e1-small` (41 notes).
- `%APPDATA%\com.graphene.app` (4 files) was backed up and hashed (SHA-256) before the first launch, and the user's `config.json` was put back right after each
  launch session. At the end the live files were hashed again against the backup: 0 differences.
- Window visibility came from a PowerShell watcher on `IsWindowVisible` for the PID that was started (`watch2.ps1`); the DOM, console, network and IPC counts
  from CDP (`Runtime`, `Log`, `Network`, `Page`, `Input`). A Tauri window focus event was triggered by minimising and restoring the window (`focus.ps1`), because the
  DOM `focus` event and `Page.bringToFront` do not reach the Rust-side focus handler.
- Only the PID that was started was ever stopped. The unrelated `msedgewebview2.exe` processes on the machine belong to Google Drive and Outlook and were not touched.
- Screenshots are in the scratchpad `e2e\shots` (names below).

## Results

| # | Check | Verdict | Key evidence |
|---|---|---|---|
| 1 | Start and window | PASS | hidden at start, visible 595 to 650 ms after spawn with 1000 notes and 50 folders already in the sidebar; no console errors; Settings, Search and Update chunks not requested |
| 2 | Themes, dark and light | PASS | notes and tasks, reading view and editor checked in both themes; thin 6 px scrollbar thumb on the sidebar and the note pane |
| 3 | Shared primitives | PASS | Settings tabs, palette with a query, context menus with shortcut hints, folder picker and language dropdown hover, toast, Trash, vault remove banner, pressed state |
| 4 | Modal focus (WP4) | PASS, app swap via "Add vault..." NOT TESTABLE | focus in the dialog, `.app` inert, Tab and Shift+Tab wrap, Escape returns focus to the opener; backdrop click leaves focus on `<body>` (oddity 1) |
| 5 | Keyboard | PASS | F2 rename wrote the file, Del and Ctrl+Z, Move up and down (note and folder, `.folder-order.json`), task checkbox `aria-label`, task detail Escape |
| 6 | Lazy bodies and indexing, 20k | PASS | hint, early title matches, late text matches, pending view, and no data changed on any of the affected files |
| 7 | Trash (lazy) | PASS | footer count 500 before opening; restore one; empty trash; `.trash` empty; attachments swept, no error |
| 8 | Rescan on focus | PASS | one `scan_vault`; `read_notes` carried exactly the appended note and the new note |
| 9 | Safety nets | PASS | missing vault gives VaultUnavailable and a visible window; a non-JSON `config.json` gives the picker's message and `config.json.bak` |

## Details per check

### 1. Start and window

- First launch (1k vault): the watcher saw the window exists but is not visible at +68 to +90 ms, still not visible at about +350 ms, and visible at +595 ms. At that moment the
  DOM already had 1000 rows and 50 folders and the label "1000 notes".
- Three more launches: visible after 601, 650 and 599 ms; the page recorder had 1000 rows and 50 folders at 541, 578 and 535 ms, before the window turned visible.
  Marks (ms after spawn): `scan-done` 513, 547, 510; `first-populated-paint` 606, 659, 600; `window-shown` 627, 672, 622; `bodies-read` 905, 966, 860.
- Console: no errors or warnings in any of the four launches.
- JavaScript requested at start: `index-CT2LT4nc.js` (376 KB), `Tooltip-DLGxu4UC.js`, `MarkdownBody-DLPxGvZF.js`, `markdown-DhQi2SnW.js` (322 KB). The Settings, Search
  and Update chunks were not requested until they were opened.
- IPC calls counted in the first launch (perf flag on): 41.

### 2. Themes

- Dark and light, notes tab and tasks tab, reading view and editor (Ctrl+E): shots `dark-01-notes-read`, `dark-02-notes-editor`, `dark-03-tasks`, `dark-04-task-detail`
  and the `light-` set with the same names. Early shots of the first launch: `01-start-dark`, `02-dark-notes-read`, `03-dark-notes-editor`, `04-dark-tasks`, `05-dark-task-detail`.
- Scrollbars: a custom track of width 6 px on the sidebar tree (height 641) and on the note pane (height 798); the thumb is 28 px high on a 1000 note list and its
  top moves with the scroll position. One thing to look at first: `02-dark-notes-read.png` (oddity 2).

### 3. Shared primitives

- Settings: all four tabs (`dark-13-settings-appearance|vaults|assistants|about`, `light-13-...`).
- Palette with a query: `dark-12-search-query`, `light-12-search-query`; 100 result rows; the active row is `rgba(200, 204, 214, 0.1)` over a panel of `rgb(15, 16, 19)`.
- Context menus show the shortcut hints. Note: Open, Edit Ctrl+E, Rename F2, Duplicate, Copy note, Move up, Move down, Move to, Reveal in Explorer, Move to trash Del.
  Folder: New note here, New code here, New subfolder, Rename F2, Move up, Move down, Reveal in Explorer, Delete folder Del. Shots `dark-05-ctx-note`, `dark-06-ctx-folder`, light the same.
- Hover of a row in the two dropdowns (the same value in both, as asked):

  | Theme | Panel | Hovered row colour | Row over the panel (composited) | Largest channel difference | WCAG ratio row to panel |
  |---|---|---|---|---|---|
  | Dark, folder picker | `rgb(15, 16, 19)` | `rgba(200, 204, 214, 0.1)` | `rgb(34, 35, 39)` | 20 | 1.212 |
  | Dark, code language | `rgb(15, 16, 19)` | `rgba(200, 204, 214, 0.1)` | `rgb(34, 35, 39)` | 20 | 1.212 |
  | Light, folder picker | `rgb(245, 246, 249)` | `rgba(27, 29, 36, 0.1)` | `rgb(223, 224, 228)` | 22 | 1.221 |
  | Light, code language | `rgb(245, 246, 249)` | `rgba(27, 29, 36, 0.1)` | `rgb(223, 224, 228)` | 22 | 1.221 |

  Both dropdowns use the same token, so they agree. The step from the panel is small (20 and 22 of 255 per channel); it is visible in `dark-07-folder-picker-hover`,
  `dark-08-code-language-hover`, `light-07-...`, `light-08-...`. This is a value to judge by eye, not a failure.
- Undo toast: text "Moved "Draft retro" to trash" with an Undo button; the button is `rgb(137, 184, 232)` on `rgba(137, 184, 232, 0.13)` in dark and
  `rgb(29, 95, 176)` on `rgba(29, 95, 176, 0.1)` in light; toast background `rgb(15, 16, 19)` and `rgb(245, 246, 249)`. After Undo the toast is gone and the note is selected again.
  Shots `dark-10-toast-undo`, `light-10-toast-undo`.
- Error toast (made by locking the note file so the save fails): "Could not save "Plan for billing"" with Retry and Dismiss; it sits outside `.app`, is not inert and its buttons
  work with a dialog open. Shots `20-dark-error-toast`, `21-dark-error-toast-over-settings`. The matching console errors (`failed to rename old path ... Access is denied (os error 5)`)
  were caused on purpose by that test.
- Trash: 500 rows, "500 items"; shots `dark-11-trash`, `light-11-trash`, `31-dark-empty-trash-confirm`.
- Vault remove banner: "Remove "e1-small" from Graphene? The folder and its notes stay on your computer." with Remove and Cancel; shots `dark-14-vault-remove-confirm`, `light-14-...`.
- Pressed state: a pressed button gets `transform: matrix(1, 0, 0, 1, 0, 1)` (down 1 px) in both themes and the background stays at its idle value. Shots `dark-09-button-pressed`, `light-09-button-pressed`.
- Folder delete is armed with a banner "Delete "Client Planning"? 20 notes inside move up to the top level. There is no Undo." and Escape cancels it (`30-dark-folder-del-armed`).

### 4. Modal focus (WP4)

- Search (Ctrl+K): `activeElement` is the search input inside the dialog, `.app` is inert, the dialog is outside `.app`. Tab and Shift+Tab alternate between the input and "Close search"
  and never leave the dialog. A click on a note behind the open dialog changes nothing (selection and open note unchanged).
- Settings: first focus on the active tab "Appearance"; 20 tab stops, Tab wraps from the last (Close) to the first and Shift+Tab the other way; `.app` inert.
- Escape: focus goes back to the opener. Opened from the gear: back on the gear button. Opened with Ctrl+K from the tree: back on the tree (`sidebar__folders`). Opened with the
  Search nav button: back on that button. Settings closed with its Close button: focus is on the tree (`sidebar__folders`).
- Vault swap while Settings is open (Vaults tab, "Open" on `e1-small`): the dialog closed, `.app` is not inert and has no leftover mark, the list changed from 1000 rows to 40 and then 41 notes;
  focus is on `<body>` afterwards (the opener was in the old app). NOT TESTABLE: "Add vault..." (native folder picker, outside what CDP can drive).
- With a dialog open: the error toast stays clickable (outside `.app`); the sidebar scrollbar thumb still follows the scroll position (top 216 px at scrollTop 0, 276 px at 3000);
  a wheel over the backdrop does not scroll the app behind (scrollTop stays 3000).
- Backdrop click closes Search and Settings (oddity 1).

### 5. Keyboard

- F2 on a note in the tree: the rename input appears, focused, with the title. Typing "F2 renamed note" and Enter renamed the file on disk
  (`log-hiring-<id>.md` to `f2-renamed-note-<id>.md`), the body hash is unchanged, the front matter title changed, the old file is gone, focus returns to the tree.
- Del on a note: moved to `.trash` ("Trash, 501 notes"), toast with Undo. Ctrl+Z with the focus on the tree restores the file (body unchanged) and the list row. Ctrl+Z in the search palette does nothing (as intended).
  Ctrl+Z straight after Del did nothing (oddity 3).
- Move up and Move down on a note: "Ideas for sprint" moved one place up and then back; the file got `order: 8192`. Sort stays "Manual".
- Move up and Move down on a folder: the first folder moved down one place and back; `.folder-order.json` after the move had distinct ranks per level
  (`Active Meetings` 1024, `Shared Guides` 2048, `Active Meetings 2` 3072, `Client Planning` 4096, `Client Snippets` 5120, `Draft Ideas` 6144, `Research Notes` 7168).
- Tasks: every task row checkbox has `aria-label` `Mark "<title>" as done` (605 rows, 0 without a label); the detail pane's checkbox is labelled the same way and its title field is `Task title`.
- Task detail Escape: typing into the title then Escape puts the saved title back and keeps focus in the field; the next Escape moves focus to the task row and the pane is closed
  (the slot is `tasks-pane__details--hidden`, width 0, `visibility: hidden`).

### 6. Lazy bodies and indexing (20k vault)

- Rows were visible after 2.3 to 3.5 s on a warm file cache (22 s on the very first cold start of the 20k vault); the bodies (`bodies-read`) landed at 7.3 s with the palette open, at 8.5 s
  with three context-menu actions during the load, and at 19.2 s in the long run with eight actions interleaved.
- (a) Ctrl+K while loading: the hint "Indexing... 1000 of 20000 notes. Titles are searchable now; text matches appear as notes load." counted up (6000, 11000, ...) and went away when the bodies were in.
  A query matched on titles after 807 ms (100 rows, every title contains the word) before any text was loaded. A word that is only in two note texts: the first match
  (note in the first folder) appeared at 5.8 s, the second (note in the last folder) at 8.1 s, 0.9 s after `bodies-read` (oddity 6).
- (b) Click on a note whose text is not read yet: the pane shows "Loading..." (the pending view) and then the real text. After opening the late note from the results the markdown contains the word and it is the text on disk.
- (c) DATA SAFETY, done before the bodies had landed, on notes whose text was not loaded: rename a note from the context menu, move a note with "Move to", rename a folder that holds 20 notes,
  click a note then F2 and rename, click a note and press Ctrl+E at once and type, and then a second round with Duplicate, Move to trash and Move up. After the bodies landed and the cascade wrote its
  files (8 s wait) every affected file on disk was compared with its hash from before:

  | Action | Result |
  |---|---|
  | Rename (context menu) | file renamed, body hash identical, title as typed |
  | Move to a folder | file in the folder, body hash identical, title unchanged |
  | Rename of a folder with 20 notes | old directory gone, new directory present, all 20 bodies identical, all 20 `folderId` updated |
  | F2 rename after a click | body hash identical |
  | Typing into the editor at once, plus a real edit | original 7999 characters still there; 8020 after = 7999 + "TYPED-EARLY" (11) + " REAL-EDIT" (10) |
  | Duplicate | copy file with the same body; original intact |
  | Move to trash | file in `.trash`, body hash identical |
  | Move up (writes a rank into the siblings) | note body identical; 19 top-level notes got an `order` |

  In the whole 20k vault there were 0 notes with an empty body, and 20000 notes before and after. The refusal of a write on an unloaded note (`useItems`) did not show up as an error toast or a console message.

### 7. Trash (lazy)

- Footer "Trash, 500 notes" before the Trash was opened (visible at start); `.trash` held 500 files; the view lists 500 rows.
- Restore of the first row: the note went back to its own folder (`Draft Ideas/Active Meetings/...`), the front matter `folderId` unchanged, body identical, the trash file gone, footer "Trash, 499 notes".
- Empty trash: the confirm button reads "Delete 499 items and unused images forever?"; afterwards `.trash` had 0 files, the view says "Trash is empty", footer "Trash, 0 notes", no error toast, no console error.
  `attachments` held 3 images right after, and 1 a few seconds later (`KlMnOpQrSt.png`, the one that a live note still uses): the sweep is asynchronous (oddity 7).

### 8. Rescan on focus

- A line was appended to a note and a new note file was created outside the app; the window was minimised and restored (Tauri focus event). The IPC log shows one `scan_vault` and one
  `read_notes` with exactly two paths: the appended note and the new note. The new row appeared (981 to 982 notes) and the open note showed the appended line.
- The first rescan after the app's own writes is bigger (oddity 4): after the keyboard checks the same cycle sent `read_notes` with 23 paths (21 unfiled notes that Move up and Move down had rewritten, plus
  the 2 outside ones). The second cycle read 2 again.
- Each rescan also makes about 22 `fs|exists` and 18 `fs|read_text_file` calls for the task store (oddity 5).

### 9. Safety nets (two separate launches)

- (a) The vault folder gone: the config pointed to `C:\gv\e1-small`, which was renamed away. The window was visible at +510 ms and shows `"e1-small" cannot be opened`, "Graphene did not find the folder
  C:\gv\e1-small. If it is on a drive or network share, connect it and try again. Your notes are not touched." with the buttons "Try again" and "Manage vaults". The folder was not recreated by the app, also
  not after "Try again" (still unavailable). When the folder was put back, "Try again" loaded 41 notes. Shot `40-dark-vault-unavailable`. Console: two `Error: C:\gv\e1-small: The system cannot find the file specified. (os error 2)` (launch and retry).
- (b) `config.json` that is not JSON: the window was visible at +422 ms and shows the picker with "Graphene could not read its list of vaults. The old file was kept as config.json.bak next to it. Choose your vault
  folder again." `config.json.bak` was created and holds exactly the broken text; `config.json` itself was left as it was. Shot `41-dark-vault-picker-corrupt`. Console: one
  `[vault] config.json cannot be read: SyntaxError: Unexpected end of JSON input`. The `.bak` was removed afterwards and the user's config restored.

## Oddities

None is a FAIL. In order of how much I would look at them.

1. Backdrop click leaves focus on `<body>`. A click on the dark backdrop closes Search and Settings, but focus is not given back to the opener (Escape and the Close button do). Evidence: opened from the tree,
   Escape gives `sidebar__folders`, backdrop gives `BODY`; same for Settings (the gear on Escape, `BODY` on the backdrop). Cause: `src/components/ui/Modal.tsx` line 78 to 81, the backdrop closes on
   `mousedown`; the mousedown default action then moves focus to `<body>` after the unmount has restored it. A `preventDefault()` on that mousedown, or closing on `click`, would likely keep the restored focus. Not tested.
2. Blue focus ring round the whole sidebar tree. After the first click on a note while the draft's textarea had focus, the tree container gets a `:focus-visible` ring (`02-dark-notes-read.png`).
   Cause: `src/components/sidebar/Sidebar.tsx` line 361 to 364 (`selectItem` calls `treeRef.current?.focus()` on the `tabIndex={0}` tree) and the global `:focus-visible` mixin (`src/assets/styles/base/_mixins.scss` line 7):
   a script-driven focus that follows a text field counts as keyboard focus. Later clicks do not show it.
3. Ctrl+Z straight after Del does nothing. Del opens a new draft and the draft's textarea takes the focus; the shortcut is off while a text field has focus. Ctrl+Z works after the focus is
   back on the tree. Cause: `src/components/note/NoteEditor.tsx` line 128 to 136 (focus on mount) with `src/App.tsx` line 281 (`when: () => !isTextField(document.activeElement)`). The toast's Undo button works at any time.
4. The first rescan after the app's own writes re-reads those notes (23 paths instead of 2 in my run). The scan stamps in `src/hooks/useVaultRefresh.ts` (`files`, refreshed by `stampsAfter` at line 109)
   are not updated when the app itself writes a note (Move up renumbering wrote 21 notes). One time per batch of writes; the next rescan was exact. On a large vault one big `read_notes` per own write batch.
5. Each focus rescan makes about 22 `fs|exists` and 18 `fs|read_text_file` calls for the tasks store (`.tasks/index.json`, `tasks.json`, and one JSON per list, `exists` twice). It is the task store, not the notes scan; it grows with the number of lists.
6. On the 20k vault the palette lags the last batch of bodies: the last text match showed about 0.9 s after the `bodies-read` mark (8.1 s against 7.3 s). Probably the 20000 notes search runs after the mark
   (`SearchPalette.tsx`, `useDeferredValue`). I did not measure which part it is.
7. The attachment sweep after Empty trash lands several seconds later (3 images, then 1) and is silent when it skips. It is asynchronous by design (`sweepUnusedImages` in `src/lib/storage.ts` line 297,
   called from `useItems.ts` line 247); it is only worth knowing when a test looks at `attachments` at once.
8. In a 20k vault, actions during the load are slow: 1.3 to 3 s each (rename, move, folder rename); the first rows came at 2.3 to 3.5 s warm (22 s cold). The bodies were read in 7 to 19 s depending on how many actions
   were interleaved. Nothing was lost in any case (check 6).
9. The DOM `focus` event and `Page.bringToFront` do not trigger the rescan, only a Tauri window focus event does (minimise and restore). A note for anyone who writes a test; it is not an app defect.

Also seen: the VaultUnavailable screen leaves the sidebar next to it with "0 notes", "Nothing here yet", and the New note and New code buttons (`40-dark-vault-unavailable`). It is not an empty vault
(the message is clear and the folder is not recreated), but I did not click New note or New code, so I do not know whether a save would create the missing folder.

## Not testable over CDP

- "Add vault..." (the native folder picker) and with it the `.app` swap through that route; the swap through the Vaults tab "Open" button was tested.
- Anything that needs a physical focus change by the user (the rescan was driven by minimise and restore of the window).
- The window rectangle from the watcher is DPI virtualised (device pixel ratio 1.25), so the sizes it prints are not the real pixel sizes.

## State at the end

- AppData `%APPDATA%\com.graphene.app` restored from the backup: 4 files, SHA-256 identical (0 differences); no `config.json.bak` left.
- No `graphene.exe` of mine left running.
- Synthetic vaults `C:\gv\e1-1k`, `C:\gv\e1-20k`, `C:\gv\e1-small`, the temporary profile `C:\gv\wv2profile` and `C:\gv\gen20k.log` deleted; the empty `C:\gv` is left (it cannot be deleted by the tools).
- Screenshots and scripts stay in the scratchpad `e2e` folder.
