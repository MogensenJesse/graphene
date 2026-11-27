# Android app: UI and UX audit

Date: 2026-11-26. Build: the debug APK from branch `ccr-e5d99dda-20d9kw` (touch commit `52c7869` plus the uncommitted Back key). Device: the
Android emulator `Medium_Phone_API_37.0` (Android API 37, Gboard). Nothing in the code was changed for this audit.

Screenshots are in [android-2026-11-26/](android-2026-11-26/) and are referred to by number (`01`, `02`, ...).

## 1. Summary

**33 findings: 0 Blockers, 14 Major, 16 Minor, 3 Polish.** No Blocker means: no data loss was reproduced (checked: type, press Home at once,
the text is on disk within 4 s), and no core task (read, write, search, add a task) is impossible by touch. #1 comes closest, and it is the
most important result of the audit. After the findings comes a design proposal, a full-screen list as the phone's home screen (now the "Phone navigation" section of plan 02), which would settle #11, #12 and
#15 and ease #26 in one piece of work.

Severity: **Blocker** = data loss, or a task that cannot be done by touch. **Major** = frequent friction, or a desktop-only interaction
with no touch route. **Minor** = cosmetic or rare. **Polish** = nice to have. Effort: **S** = a few lines in one or two files,
**M** = a component or several files plus device testing, **L** = a new mechanism or a design decision first.

### The five that matter most

1. **Writing a long note with the keyboard up scrolls the header and the formatting toolbar off the screen (#1).** The page does not shrink
   when the keyboard opens, so Android pans it. Worst on a small phone and in landscape (5 lines of text visible). **Fixed in Round 2.**
2. **The app never says that notes live inside the app and are deleted on uninstall, and there is no export (#2).** Plan 02 listed this as a
   risk to "say so in the UI". This is the one data-safety gap left.
3. **The header's Copy, More and Edit buttons shrink to 19-26 px wide when a title is long (#3).** The main actions of every note become
   hard to hit, and neighbours overlap.
4. **Settings is the desktop two-column dialog squeezed into a phone (#4).** The controls are clipped (`Custom` is cut off), and the Vaults
   section overflows.
5. **The task checkbox is about 20 px to hit (#5)**, in the most-used list in the app.

### What already works well

- The search palette on a phone (S: top-anchored, 58 px results, highlights, four results above the keyboard, screenshot `23`).
- Long-press menus: 44 px rows, opens at the finger, folders have Move up / Move down / Move to as a touch route for what dragging does
  on a desktop (screenshot `22`).
- Adding tasks: the keyboard stays up for rapid entry (screenshot `28`).
- Data safety: autosave reaches the disk while the app is in the background (checked, see "Checked, fine").
- Contrast in the light theme: 0 failures on the drawer, a note and the tasks (all text tokens against their backgrounds).
- The dark theme looks coherent, rotation and dark-mode switches keep the state, long unbroken words and URLs wrap, the code view with line
  numbers and wrapping reads well (screenshot `27`).

## 2. Findings, ranked

Conditions: **D** default phone (411x914 dp, light), **K** dark theme, **S** small phone (360x640 dp), **F** system font 1.3x,
**L** landscape (914x411).

| # | Sev | Finding | Screen | Seen in | Effort |
|---|---|---|---|---|---|
| 1 | Major | Keyboard pans the header and toolbar off the screen (fixed, Round 2) | Editor | D S L | M |
| 2 | Major | Notes are app-private and deleted on uninstall; nothing says so, no export (the warning is fixed, Round 3; the export is not) | About, Vaults | D | S + L |
| 3 | Major | Header buttons shrink to 19-26 px wide | Note header (read, edit) | D S F | S |
| 4 | Major | Settings is a desktop dialog on a phone; controls clipped (fixed, Round 3) | Settings | D S F | M |
| 5 | Major | Task checkbox is about 20 px to hit | Tasks | D | S |
| 6 | Major | Formatting toolbar: 5 of 14 buttons hidden with no cue; no undo, redo or indent (fixed, Round 2) | Editor | D | M |
| 7 | Major | Touch drag does nothing; tasks cannot be reordered by touch (fixed, Round 6) | Drawer, Tasks | D | S + L |
| 8 | Major | Tables are crushed into the column, words break mid-word (fixed, Round 3) | Read view | D | M |
| 9 | Major | Task-list rows in the drawer are 28 px high | Drawer (Tasks) | D | S |
| 10 | Major | Vault controls for a phone with one private vault: dead "Add vault...", Remove, AI share (fixed, Round 3) | Drawer, Settings | D | S |
| 11 | Major | Cold start lands on a blank draft editor (fixed, Round 4) | Launch | D | M |
| 12 | Major | The keyboard opens over the open drawer | Drawer, Editor | D | S |
| 13 | Major | Back key exits the app after a system font or display size change | System | F | S |
| 14 | Major | Task checkboxes inside a note are 14 px | Read view | D | S |
| 15 | Minor | The drawer cannot be swiped open or closed | Drawer | D | M |
| 16 | Minor | Folder picker dropdown runs off the right edge | Editor header | D | S |
| 17 | Minor | Task details: small targets, the pane covers the list, calendar cells 30 px high | Tasks | D S | S |
| 18 | Minor | Completing a task gives no feedback | Tasks | D | S |
| 19 | Minor | Small phone: the drawer's fixed block takes 55% of the height (fixed, Round 4) | Drawer | S | S |
| 20 | Minor | Hover highlights stay after a tap (fixed, Round 5) | App-wide | D | S |
| 21 | Minor | Tertiary text is 3.8:1 in the dark theme | App-wide | K | S |
| 22 | Minor | "Text width" strips at the screen edge, no touch route | Read view, Editor | D | S |
| 23 | Minor | The editor opens with the keyboard up and the caret at the end of a long note (fixed, Round 5) | Editor | D | S |
| 24 | Minor | Settings copy says "follows Windows" | Settings | D | S |
| 25 | Minor | Trash: "Delete forever" has no danger styling, 14 px from "Restore" | Trash | D | S |
| 26 | Minor | Deep folders truncate note titles | Drawer | D | S |
| 27 | Minor | Autosave does not flush when the app goes to the background | System | D | S |
| 28 | Minor | Wrapped checklist items restart under the box; mixed lists lose bullets | Read view | D | S |
| 29 | Minor | The launcher icon is Tauri's default | Launcher, start screen | D | S |
| 30 | Polish | The long-press menu opens under the finger and covers the row | Menus | D | S |
| 31 | Polish | Floating-panel chrome costs 20 px of width; mid-grey frame in the dark theme | App-wide | D K | S |
| 32 | Polish | Meta text is 11-12 px | App-wide | D | S |
| 33 | Minor | Status bar icons follow the phone's light/dark mode, not the app's Theme setting (found while fixing #21; fixed, Round 5) | App-wide | D K | M |

### 1. Keyboard pans the header and toolbar off the screen: Major, M

- **Seen in:** D, S, L (worse each time).
- **Evidence:** screenshots `01` (default), `02` (small phone), `03` (landscape). On a long note the editor opens with the caret at the end
  and the keyboard up. The layout viewport is **not** resized (`innerHeight` 914, `.app` 914 tall), so Chrome pans the visual viewport
  instead: `visualViewport.offsetTop` 70.9 css px, `height` 702. The header (Done, Copy, More), the title and the formatting toolbar are
  scrolled above the screen, and the status-bar clock sits on top of the text. Small phone: `height` 433, `offsetTop` 69. Landscape:
  `height` 202, about five lines of text, and the status-bar clock overlaps the sidebar's Search row. The pan only happens while the
  caret is in the lower part of the text that the keyboard covers (screenshot `04` shows the caret high: header and toolbar stay), so
  typing down a long note hits it all the time. The Tasks add box also sits in a layout that is 336 px taller than what is visible
  (visual 578 vs 914), see `28`.
- **Cause:** `src/assets/styles/app/_app.scss:24` (`height: 100vh`), `src/assets/styles/base/_reset.scss:19` (`min-height: 100vh`) and the
  viewport meta in `index.html:5` (`width=device-width, initial-scale=1.0, viewport-fit=cover`, no `interactive-widget`).
- **Why it matters:** the Done button and the toolbar are the two controls you need while writing, and they are not reachable while the
  caret is in the lower half. Back works (it saves and leaves the editor), which is why this is not a Blocker.
- **Fix:** add `interactive-widget=resizes-content` to the viewport meta and use `100dvh` in `_app.scss` and `_reset.scss`, so the layout
  follows the keyboard; make the toolbar `position: sticky` so it stays at the top of the visible area. **Risk:** whether the Android
  WebView honours `interactive-widget` is not verified (plan 02 notes a Tauri report that needed a Kotlin window-insets fix); if it does
  not, the fallback is `adjustResize` plus insets in `MainActivity` and the effort grows to L. Test again in D, S and L.

### 2. Notes are app-private and deleted on uninstall; nothing says so, and there is no export: Major, S + L

- **Seen in:** D (About, Vaults).
- **Evidence:** screenshots `14` and `13`. About says nothing about where notes live. The Vaults panel shows the internal path
  (`/data/user/0/com.graphene.app/...`) and offers "Remove" for the only vault. There is no export or backup route anywhere in the app.
  Plan 02 (`docs/plans/02-android-app.md`, "Risks": "Say so in the UI") and open item 2 (an export before sync exists) both predicted this.
- **Why it matters:** uninstalling the app (or "Clear storage") deletes every note and task with no way back. A tester who reinstalls to
  update, rather than installing over the old APK, loses everything.
- **Fix:** S: a sentence in About and at the top of Vaults ("Your notes are stored inside this app. Uninstalling the app deletes them.").
  L: an export (a .zip of the vault through the share sheet) and, later, import. That is a product decision, listed in plan 02.

### 3. Header buttons shrink to 19-26 px wide: Major, S

- **Seen in:** D, S, F.
- **Evidence:** screenshot `05`. With the title "Long note for scr..." the folder chip squeezes to "No f..." (70x24) and the Copy, More and Edit
  buttons measure **19 x 36, 19 x 36 and 26 x 36 css px**. In the editor: Copy and More 24 x 36, Done 46 x 36, chip "No..." 61 x 24. Small
  phone: 19, 19, 27. `_Touch.scss:21` asks for 40 px, so they are being shrunk by the flex row: `_ItemHeader.scss:121-133` has no
  `flex-shrink: 0` on `.item-header__actions .icon-btn`. Because the buttons move with the title length, a tap meant for the folder
  chip hit Copy note once during the audit.
- **Why it matters:** these are the primary actions of every note. At 19 px wide, with a neighbour 6 px away, mis-taps are certain.
- **Fix:** `flex-shrink: 0` and `min-width: var(--icon-btn-size)` on the header buttons; let the title and the chip give way instead (the
  title truncates, the chip shows only the folder icon on a phone).

### 4. Settings is a desktop dialog on a phone: Major, M

- **Seen in:** D, S, F.
- **Evidence:** screenshots `11` (default), `20` (small phone), `21` (font 1.3x). The dialog is a 176 px side list plus the body inside
  `min(720px, 100vw - 40px)` (`_Settings.scss:21`, 371 px wide), so the body is **195 px** (143 px on the small phone). Segmented controls do
  not fit: "Default System Serif Custom" is cut at the edge; the Code font control wraps "Courier New" to two lines and clips "Custom" to
  "Cus" (screenshot `12`), and to "C" at font 1.3x. Segment buttons are 27-46 x 32 css px. The drawer stays open behind the dialog.
- **Why it matters:** options cannot be read or reached, so some font choices are impossible to select by touch.
- **Fix:** below 600 px, stack the side list on top of the body (or make it a first screen with Appearance / Vaults / About rows that
  opens a full-screen pane with a back arrow); let segmented controls wrap or turn into a select; 44 px rows.

### 5. Task checkbox is about 20 px to hit: Major, S

- **Seen in:** D.
- **Evidence:** the checkbox is 18 x 18 (`_Checkbox.scss:49-50`); `elementFromPoint` hits it only within about 10 px, and the row's main
  button begins 12 px to its right. The star is 40 x 40 and the row is 48 high.
- **Why it matters:** the control used most often is the smallest one, and a miss opens the details pane instead of ticking.
- **Fix:** a 44 x 44 hit area around the box (padding or a `::before` that extends the target; the box stays 18 px).

### 6. Formatting toolbar: hidden buttons, no undo, redo or indent: Major, M

- **Seen in:** D.
- **Evidence:** the toolbar (`MarkdownToolbar.tsx:44-102`) has 14 buttons in a row that scrolls sideways (`_Touch.scss:79-83`). Nine fit; Quote,
  Inline code, Code block, Link and Divider are off-screen with no fade or peek to say there is more (screenshot `04`). There are no Undo,
  Redo, Indent or Outdent buttons, and a phone has no Ctrl+Z, Tab or Shift+Tab. (I did not test whether Gboard's own undo reaches the editor.)
- **Why it matters:** nesting a list and undoing a mistake are routine, and neither has a touch route.
- **Fix:** add an edge fade (or a half-visible button) as a scroll cue; add Undo, Redo, Indent and Outdent as the first buttons on a
  coarse pointer; with #1 fixed, keep the toolbar sticky.

### 7. Touch drag does nothing; tasks cannot be reordered by touch: Major, S + L

- **Seen in:** D.
- **Evidence:** screenshot `29`: a 1.5 s touch drag of a note row onto a folder row moved nothing and drew no drop marks. Notes and folders
  have "Move to" and folders "Move up / Move down" in the menu (`Sidebar.tsx:727-741`, `FolderRow.tsx:239-251`), so for them there is a route.
  The task menu has no "Move up / Move down", so the manual order of tasks cannot be changed on a phone at all. (Not checked: moving a task
  to another list by touch.)
- **Why it matters:** an order the user cannot change is a feature missing on one platform.
- **Fix:** S: "Move up / Move down" in the task menu (the folder code is the model). L: long-press-to-arm dragging in `useDragToFolder`
  (already listed as to do in plan 02).

### 8. Tables are crushed into the column: Major, M

- **Seen in:** D.
- **Evidence:** screenshot `06`. A table in the read view takes the column width (about 370 px); there is no scroll wrapper
  (`_NoteDetail.scss:43`), so cells break mid-word ("Stat us", "Parse r rewrit e") and the table text is 11.96 px.
- **Why it matters:** a table with more than two columns cannot be read.
- **Fix:** wrap the table in a block with `overflow-x: auto` and `min-width: max-content` on the table (or `white-space: nowrap` on
  headers). Effort M because the renderer needs a custom `table` component.

### 9. Task-list rows in the drawer are 28 px high: Major, S

- **Seen in:** D.
- **Evidence:** screenshot `07`. The list rows ("Bugs", "Chores", ...) measure 158 x 28 and 174 x 28. `_TaskLists.scss:30` has `height: 28px`
  hard-coded instead of reading `--row-nav` / `--row-tree` like the notes tree (44 px). The vault switcher is 62 x 24, group headers are
  short, and the tab control is 115 x 32.
- **Fix:** `height: var(--row-tree, 28px)` in `_TaskLists.scss`; give the vault switcher and tab control the 40 px treatment.

### 10. Vault controls for a phone with one private vault: Major, S

- **Seen in:** D.
- **Evidence:** screenshots `13` and (drawer header) `07`. "Add vault..." in the drawer's vault menu does nothing visible: the error is
  only logged (`VaultSwitcher.tsx:37-39`, console: "Folder picker is not implemented on mobile"). "Manage vaults..." is offered, the
  Vaults panel offers "Remove" for the only vault, reorder arrows for one vault, "Share with AI assistants" (`VaultsPanel.tsx:150`) although the
  Assistants tab does not exist on Android, the vault name is clipped to "N", and the copy says "Switch between them from the top of the
  sidebar".
- **Fix:** on Android hide "Add vault...", "Remove", the reorder arrows, the share checkbox and the path; show "Notes, stored in the app".
  The vault switcher in the drawer can be a plain title until there is more than one vault.

### 11. Cold start lands on a blank draft editor: Major, M (decision first)

- **Seen in:** D.
- **Evidence:** screenshot `24`. A cold start in Notes mode shows an empty "Untitled" draft with the full editing chrome. The note list is
  behind the hamburger. Tasks mode restores its last list.
- **Why it matters:** the first thing a returning user sees is an empty page, not their notes.
- **Fix:** decide what "home" is on a phone: open the last viewed note (as Tasks does), or open with the drawer showing the list.

### 12. The keyboard opens over the open drawer: Major, S

- **Seen in:** D.
- **Evidence:** screenshot `08`. Switching the drawer to Notes while the empty draft editor is behind it focuses the editor, so the keyboard
  rises over the drawer and hides the lower half of the note list.
- **Fix:** do not autofocus the editor while the drawer is open (the drawer is modal on a phone); focus only on a user action.

### 13. Back exits the app after a system font or display-size change: Major, S

- **Seen in:** F.
- **Evidence:** reproduced. With the drawer open, Back closed it. After a live `font_scale` change (the activity is recreated), the same Back
  killed the process. Rotation and dark-mode changes do not do this. `AndroidManifest.xml:14`
  (`src-tauri/gen/android/app/src/main/`) lists `configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"`,
  with no `fontScale` or `density`.
- **Why it matters:** the Back stack stops working with no sign; a change of display size is something people do on a real phone.
- **Fix:** add `fontScale|density` to `configChanges`. **Note:** `gen/android` was git-ignored, so the fix needed the Android project to
  be tracked (done in Round 1, see "Round 1 status").

### 14. Task checkboxes inside a note are 14 px: Major, S

- **Seen in:** D.
- **Evidence:** screenshot `26` and `_Checkbox.scss:10-11` (14 x 14). A tap toggles the text of the note ("[ ]" to "[x]").
- **Fix:** a 44 px hit area (as #5) on a coarse pointer.

### 15. The drawer cannot be swiped open or closed: Minor, M

- **Evidence:** swipe right from the left edge does not open it, swipe left on it does not close it. Only the toggle, the scrim and Back do.
  Plan 02 promised a swipe-in. **Note:** the left edge is also the system Back gesture zone in gesture navigation, so the swipe has to
  start 24-40 px in, or work from anywhere on the note.

### 16. Folder picker dropdown runs off the right edge: Minor, S

- **Evidence:** screenshot `15`. The panel is anchored at the chip's left edge and its 171 px items start at x 244, so the right side is
  clipped. The items themselves are 44 px (good).
- **Fix:** clamp the popover to the window's width (the context menu already does).

### 17. Task details: small targets, pane covers the list, calendar cells 30 px high: Minor, S

- **Seen in:** D, S.
- **Evidence:** screenshots `09` and `10`. The details pane slides over the list and leaves a sliver of about 15% (the title is cut to
  "In"); the only way out is the chevron. Step checkbox 14 x 14, option rows 36 high, "Delete task" 96 x 36, step input 28 high. Calendar
  day cells are 38 x 30 css px, the weekday header 11 px, the Today / Tomorrow / Clear footer is text buttons, and the popover covers the
  rows below. On the small phone the pane is almost full width, which is fine (a sliver of about 30 px).
- **Fix:** 44 px rows in the pane, day cells 44 x 40, make the pane full width on a phone with a back arrow.

### 18. Completing a task gives no feedback: Minor, S

- **Evidence:** (no screenshot) the row vanishes at once into "Completed (6)"; no toast, no animation. With a 20 px checkbox
  (#5) a mis-tap is silent. It is not destructive: Completed is one tap away and unticking restores it.
- **Fix:** a short "Completed. Undo" toast (the delete toast is `UndoToast`, `App.tsx:533-541`).

### 19. Small phone: the drawer's fixed block takes 55% of the height: Minor, S

- **Seen in:** S. **Evidence:** screenshot `19`. The header, tabs, Search / New note / New code and the list header leave about four tree
  rows at 360x640 dp.
- **Fix:** let that block scroll with the list on short screens, or fold Search / New note / New code into one row of three buttons.

### 20. Hover highlights stay after a tap: Minor, S (app-wide)

- **Evidence:** confirmed (screenshot `16`): after tapping the drawer toggle and closing the drawer, `toggle.matches(':hover')` and
  `:focus` stay true and its background stays `rgba(27,29,36,.05)`. There are 55 `:hover` rules in 20 SCSS files and none inside
  `@media (hover: hover)`.
- **Fix:** put the hover styles in a mixin that emits `@media (hover: hover)`, then convert the 20 files (mechanical, one pass).

### 21. Tertiary text is 3.8:1 in the dark theme: Minor, S

- **Seen in:** K. **Evidence:** contrast measured with the page's computed colours: tertiary text on the panel is **3.80:1** (needs 4.5)
  on 12-13 px meta text: the task row meta ("Chores", "Tuesday"), the counts, and "Edited today . 1665 words". Nav counts 4.26, the
  "Notes" segment 4.49. Light theme: 0 failures.
- **Fix:** lighten `--color-text-tertiary` in the dark theme (one token).

### 22. "Text width" strips at the screen edge, no touch route: Minor, S

- **Evidence:** `ColumnResizer` (`NoteDetail.tsx:198`, `NoteEditor.tsx:526`) puts 8 px strips (`touch-action: none`) at x 390-398, inside the
  system Back-gesture zone (swipes that start in the right ~30 px do not scroll, as in every app). Note width can only be set by dragging
  them (and double-click to reset), so a phone has no route.
- **Fix:** hide `ColumnResizer` on `pointer: coarse` (the width is the screen).

### 23. The editor opens with the keyboard up and the caret at the end of a long note: Minor, S

- **Evidence:** on a long note, Edit puts the caret at 9147 of 9147 and raises the keyboard at once, which also starts the pan in #1.
- **Fix:** on a coarse pointer, open the editor at the scroll position of the read view with no focus, and focus on the first tap.

### 24. Settings copy says "follows Windows": Minor, S

- **Evidence:** `src/components/settings/AppearancePanel.tsx:178`: "System follows Windows and changes with it." Shown on Android (screenshot `11`).
- **Fix:** "System follows the device setting." (or by platform).

### 25. Trash: "Delete forever" has no danger styling, 14 px from "Restore": Minor, S

- **Evidence:** screenshot `25`. "Delete forever" (93 x 36) is plain grey text next to "Restore" (59 x 36). A confirm bar exists
  (`TrashView.tsx:161`; not exercised by touch). The header's "Empty trash" is icon-only (29 x 36). A trashed note cannot be opened to look
  at first.
- **Fix:** danger colour and more space (or move "Delete forever" into the long-press menu, where it already is: `TrashView.tsx:125`).

### 26. Deep folders truncate note titles: Minor, S

- **Evidence:** screenshot `08`: at the third level "Questions about r..." is cut. The indent per level costs width.
- **Fix:** a smaller indent step on compact screens.

### 27. Autosave does not flush when the app goes to the background: Minor, S

- **Evidence:** `src/lib/appFocus.ts:14-17` only listens for the app coming back (`visibilitychange` to visible). Checked, fine in practice:
  typing, pressing Home at once, the text was on disk within 4 s while backgrounded (autosave is 800 ms). The window is the 800 ms
  before the debounce fires, if Android kills the process in that time.
- **Fix:** flush on `visibilitychange` to hidden and on `pagehide` (the Back key already flushes).

### 28. Wrapped checklist items restart under the box; mixed lists lose bullets: Minor, S

- **Evidence:** screenshot `26`. A long checklist item wraps back under the checkbox (no hanging indent). Separately (not mobile-specific):
  a list that mixes bullets and one `[ ]` item shows the plain items without bullet markers (`contains-task-list`).

### 29. The launcher icon is Tauri's default: Minor, S

- **Seen in:** D (found after the main pass, from the launcher).
- **Evidence:** screenshot `30`: "Graphene" in the app list shows Tauri's default icon. `src-tauri/icons/` has no `android` folder (`tauri icon`
  was never run for Android), so the generated project in `src-tauri/gen/android` carries the default `mipmap-*` icons. The logo exists:
  `src-tauri/icons/app-icon.svg` (the hexagon, a light grey outline on transparent). The Android 12 start screen shows the same icon.
- **Why it matters:** it is the first thing a tester sees, and it makes the build look unfinished.
- **Fix:** generate the Android icons from the logo with a `tauri icon` manifest (a solid dark background and the mark inside the adaptive icon's
  safe area, because the logo is a light outline on transparent), copy them over `gen/android`, rebuild. The steps are in plan 02, "App icon".

### 30. The long-press menu opens under the finger: Polish, S

- **Evidence:** screenshot `22`. The menu is at the touch point and covers the pressed row; the pressed row is highlighted for folders but
  not for tasks. **Fix:** open the menu above or beside the finger, and highlight the pressed task.

### 31. Floating-panel chrome costs 20 px of width; mid-grey frame in the dark theme: Polish, S

- **Evidence:** screenshot `17`. The 10 px margin and radius around the panel leave 391 of 411 px for content, and in the dark theme the frame and
  the status-bar band are mid-grey (the desktop acrylic fallback) around a near-black panel.
- **Fix:** on a phone, drop the margin and radius (full-bleed panel).

### 32. Meta text is 11-12 px: Polish, S

- **Evidence:** `_variables.scss:135-139` (`--fs-xs` 11 px to `--fs-xl` 15 px). `_Touch.scss` raises targets but not text. Seen in the word count, counts,
  the calendar weekday header (11 px), table and code text (11.96 px).
- **Fix:** a coarse-pointer type scale: `--fs-xs` 12, `--fs-sm` 13.

### 33. Status bar icons follow the phone's light/dark mode, not the app's Theme setting: Minor, M

- **Seen in:** D with Theme = Dark on a light phone (found during Round 1, after #21 made the dark frame near-black).
- **Evidence:** screenshot `31`: the clock and icons are dark grey on the near-black frame and almost invisible. The bars' icon colour is
  set by `enableEdgeToEdge()` in `MainActivity.kt`, which reads the system's night mode, not the page's `data-theme`. The same happens the
  other way round (Theme = Light on a dark phone: light icons on a light frame), which I did not capture. A live switch of the system's own
  mode was a related bug (the icons kept the old mode's colour) and is fixed in Round 1 (`onConfigurationChanged`).
- **Why it matters:** the clock and battery are unreadable for anyone who sets Theme against the phone's mode.
- **Fix:** tell the native side the page's theme: a small Tauri command (or mobile plugin) that sets
  `WindowCompat.getInsetsController(...).isAppearanceLightStatusBars` and the same for the navigation bar, called from `lib/theme.ts` when
  the theme is applied. Tauri's own `setTheme` does nothing on Android. Effort M because it is the first Kotlin-side command.

### Design proposal: a full-screen sidebar on phones (not a finding)

**Update (same day): this grew into the "Phone navigation" proposal in plan 02**, whose direction is agreed: the full-screen list as the
home screen below, plus a bottom bar (Notes | Tasks, also on the note screen), a "+" button that makes a new note, a search field on the
list, a note header with one `[...]` menu, and a cold start on the list at the last used tab. Wireframes and the open questions are there.
What follows is the first, narrower version and what it settles.

Not something the audit found wrong in itself, but a change that would settle several findings at once. On a touch screen narrower than about 600 px the sidebar would fill the screen
instead of floating as a 252 px drawer over a dimmed note. The note list becomes the app's home screen: a cold start shows it, tapping a note
opens it, and Back goes from the note to the list and from the list out of the app. The floating drawer stays from 600 to 800 px and the docked
sidebar above that; narrow desktop windows keep the drawer (the rule is `pointer: coarse`).

| Finding | Effect |
|---|---|
| #11 Cold start on a blank draft | Settled: the first screen is the list. |
| #12 Keyboard over the open drawer | Settled for the drawer; the editor behind it should still not autofocus. |
| #15 No drawer swipe | Gone: nothing to swipe, and the system Back gesture (the same left-edge swipe) is the way back from a note. |
| #26 Deep folders truncate titles | Eased: 391 px of width instead of about 230. |
| #19 Small phone: fixed block of the drawer | Not helped by this version alone; the full proposal settles it: Search becomes a field and New note a button, so the block goes away on a phone. |
| #9, #10 and the rest of the drawer | Not affected. |

Costs: the header's sidebar toggle becomes a "back to the list" button; the note is not visible behind the list; the Back stack gains one step
(registered while a note is open on a phone); the first screen at launch needs a choice (the list always, or the last note). It was not
prototyped, so the effort is an estimate: M. **Recommendation:** yes. Do it with #11, before building a drawer swipe (#15).

## 3. Proposed fix order

**Round 1, quick wins (all S, one sitting, no design decisions):** #13 (`configChanges`), #3 (header `flex-shrink`), #5 and #14 (checkbox
hit areas), #9 (list row height), #12 (no autofocus under the drawer), #16 (popover clamp), #22 (hide the width strips), #24 (copy), #25, #21 (one
token), #27 (flush on hide), #18, #26, #19, #29 (the icon). Together they clear 6 of the 14 Majors (#3, #5, #9, #12, #13, #14).

**Round 2, the keyboard and the dialogs (M):** #1 (with #6 and #23: the editor as one piece of work, tested in D, S and L), then #4 and #10
(Settings and the vault UI for a phone), then #8 (tables) and #17.

**Round 3, decisions first:** #2 (warning now; decide on export), #11 together with the phone navigation proposal (plan 02; the list is "home" on a phone, with a
bottom bar; it also settles #15, #19 and #26, so it comes before any drawer swipe), #7 (touch drag, or only "Move up/Move down" for tasks), #20 (hover
mixin, mechanical but touches 20 files).

Polish (#30-#32) when the rest is done.

### Round 1 status (2026-11-26)

Round 1 was done in the working tree (nothing committed) and checked on the emulator after each build. Fixed and verified:

| # | What changed | Checked by |
|---|---|---|
| 3 | The header's buttons and their container no longer shrink (`_ItemHeader.scss`), `.btn--icon` is as wide as the sm height (`_Button.scss`: it was 24px wide next to a 36px height), the "Edit" button has a minimum width (`_Touch.scss`) | Copy, More and Edit measure 36 x 36 each, the header does not overflow (was 19-26 x 36). The folder chip still truncates to "N..." beside a long title |
| 5, 14 | A 44px tap area around every checkbox (`.checkbox::before`, `_Touch.scss`) | `elementFromPoint` hits the box up to 20px away; a real tap 17px beside a task's box ticked it and did not open the details |
| 9 | The Tasks drawer's list rows read `--row-tree` (`_TaskLists.scss`); the vault name is 36px and `.segments` items 40px | Rows 44px, vault 36, switch 40 |
| 12 | A blank draft that returns behind the open drawer is not focused (`draft.focus`, `NoteEditor` `focusOnMount`); the New note button also closes the drawer when a blank draft is already open (it did not, and the keyboard rose over it) | Tasks to Notes with the drawer open: no keyboard; New note: drawer closes, keyboard up |
| 13 | `fontScale\|density` in `configChanges`; `gen/android` is now tracked in git so the edit survives | After a live font-scale change the process is the same and Back closes the drawer |
| 16 | The folder list opens from the chip's right edge (left again in the wide layout) | Dropdown at 125-305 px of 411 |
| 21 | Android only: opaque dark surfaces and a tertiary text of 0.64 alpha (`_variables.scss`) | Contrast failures 0 on the drawer, a note, tasks and Trash (was 3.80 on tasks and notes); also settles the mid-grey frame in #31 |
| 22 | The text-width strips are hidden on a touch screen | `display: none` |
| 24 | "System follows the device's light or dark setting" (all platforms) | Read |
| 25 | "Delete forever" is red and 20px from Restore | Computed colour and gap |
| 26 | A folder's contents step in 15px a level, not 27 | Rows 9px further in per level (plus 6px padding) |
| 27 | A hidden page saves what is pending at once (`visibilitychange`, `pagehide`) | With the event the text is on disk right after typing; without it, not until the autosave delay |
| 29 | The logo on a dark background as an adaptive icon (`icon-manifest.json`, `app-icon-fg.svg`, `app-icon-bg.png`) | Screenshot `32` |

Not done: **#18** (skipped on purpose: Completed is one tap away) and **#19**. For #19 the choice was to let the drawer's top block scroll
with the list, but that means moving the Search / New note rows into the list's scroll area in two components (and keeping them pinned
on desktop), and the phone navigation in plan 02 removes the block on phones, so #19 is folded into that work instead of built twice.

Found while fixing: the status-bar icons kept the old mode's colour after a live light/dark switch (fixed: `MainActivity.kt`
`onConfigurationChanged`), and they do not follow the app's Theme setting at all (new finding #33, not fixed). The tracked `gen/android`
folder is 46 files; `assets/mcp` (the desktop MCP server that the build copies into the APK, which Android does not use), `gen/schemas`
and `.kotlin` are ignored.

### Round 2 status: the editor (2026-11-26)

Done in the working tree (nothing committed) and checked on the emulator after two builds.

| # | What changed | Checked by |
|---|---|---|
| 1 | `MainActivity.onCreate` pads the content view by the keyboard's inset, so the WebView and the page's window end where the keyboard starts; `windowSoftInputMode=adjustResize` for Android before 11; `.app` is `height: 100%` and body `min-height: 100%` instead of `100vh` | `innerHeight` 578 with the keyboard up (was 914), `visualViewport.offsetTop` 0 (was 70), header at 24-76, caret and toolbar visible: screenshots `33` (default), `34` (small phone, `innerHeight` 326), dark theme and 1.3x font the same. The search palette also sits above the keyboard |
| 6 | On a touch screen the formatting row is under the text, so it sits on the keyboard; the ends fade where there is more to scroll to (scroll-driven, no script); Undo and Redo come first, Outdent and Indent follow the lists (`FormatType` `indent` and `outdent`: Tab's `shiftListIndent` on a list line, else two spaces; one Vitest case). None of the four show on a computer or in the right-click Format menu | Undo and Redo step through typed text and keep the keyboard and focus; Indent twice then Outdent twice on a list line gave 4, 2 and 0 spaces; the row scrolls (425 px) and fades at the left once moved: `36` |
| 1 (landscape) | A window under 300px tall while the text has the focus hides the title bar, the word count and the sidebar button, and shrinks the row | 150px window: about 3 lines of text and the row (`35`); without this rule the text area was 0 px tall (the pan had hidden that before) |

Found while fixing: a runtime change of `interactive-widget=resizes-content` (and `100dvh`) did nothing in the WebView (`innerHeight` stayed
914), so the Kotlin inset is what makes the layout follow; the meta was not shipped. A tapped toolbar button keeps its hover background until
the next tap elsewhere (#20, not fixed). **#23 is not touched** (the editor still opens with the keyboard up and the caret at the end of a long
note; the caret is at least visible now): whether a touch screen should open an existing note without focusing it is a design choice for later.
Not checked: a real phone (other keyboards, the IME animation, split-screen), and a computer (the touch-only rules sit behind
`not (pointer: coarse)`, but the desktop app was not run again).

### Round 3 status: Settings, vaults and tables (2026-11-26)

Done in the working tree (nothing committed) and checked on the emulator after three builds (the first two showed layout mistakes that are
fixed: tabs as wide as the screen, and the footer lying over the body).

| # | What changed | Checked by |
|---|---|---|
| 4 | On a touch screen Settings is a full screen, not a dialog (`_Touch.scss`, no component change): the title and the sections as three tabs across the top (44px), the open section below (full width, 16px padding, scrolls), and a full-width 44px Close at the bottom. The status and gesture bars are the panel's padding | Body 411 px wide (was 195); no segmented control overflows or clips an item on the default phone, the small phone (360 dp) and at 1.3x font after a relaunch (the tabs still fit): screenshots `37`, `40` |
| 10 | On Android the vault is one name: the drawer's vault chip is plain text (no menu, no "Add vault…"), and Settings, Vaults has no path, order arrows, "Open" tag, "Share with AI assistants", "Remove" or "Add vault…" (`IS_ANDROID` in `VaultSwitcher` and `VaultsPanel`) | Screenshot `38`; `.settings__vault-order` is not in the page |
| 2 (the warning) | "Your notes are stored inside this app. Uninstalling the app, or clearing its storage, deletes them." at the top of Vaults and as "Your notes" in About (`PRIVATE_VAULT_NOTICE` in `lib/platform.ts`) | Screenshots `38` and the About tab |
| 8 | A markdown table is wrapped in a scrolling box (`.md-table`, the shared `MARKDOWN_COMPONENTS`), and its cells break between words only (`word-break: normal`, where the note's `break-word` let a column shrink to a letter). This is for every platform | The 7-column table is 455 px in a 352 px box and scrolls (scrollLeft 103 after a swipe, the last column reachable): screenshot `39`; "Alexandra Montgomery" and "In progress" break at the space |

Not done: **#2's export** (a product decision, still open in plan 02). Not checked: the desktop app (the table change and the `IS_ANDROID` checks
are the only rules that reach it, and the Settings screen is behind `pointer: coarse`), and a real phone. The drawer stays open behind Settings and
is there again after Close, as before.

### Round 4 status: the phone navigation (2026-11-26)

Done in the working tree (nothing committed) and checked on the emulator after four builds. The design is the "Phone navigation" section of
plan 02 (agreed 2026-11-26): on a phone the sidebar is a full-screen list, Notes | Tasks is a bottom bar, and every screen has a back arrow.

| # | What changed | Checked by |
|---|---|---|
| 11 | The app starts on the list, on the tab used last (`compactOpen` starts true on a phone; the blank draft behind it is not focused) | Cold start on Tasks: the lists, no keyboard; on Notes: the notes, "+" and the bar (`41`) |
| 19 | On the list only Search stays above the notes (a field); the Notes / Tasks switch is the bottom bar, New note is the "+", New code is gone from the phone | Small phone and dark: `46` |
| 12, 15, 26 | No drawer: the list is the home and Back is the way back, so there is nothing to swipe and the keyboard cannot open over it; its rows have the full width | Back from a note, the editor (the keyboard first), the Trash, task details and the tasks pane each reached the list; Back on the list left the app |
| 3 | The note header has no folder chip ("Move to" is in "..."), so the title has about 130 px more | Title 132 px wider (`42`, `43`) |
| 17 (details) | A task's details are full width, with Back closing them | The slot was 391 px wide: `45` (the pane inside it was not: Round 7) |

Found while building: the Undo bar of a delete was behind the list (it lives in the note's panel, which the list now covers), so on a phone the
bars are drawn above it; a search result and "Edit" from a row's menu now close the list explicitly; the list's focus is dropped on Back, or a
blank draft under it keeps the keyboard up and the bottom bar hidden. Not done: the list's `[...]` menu (Settings and Trash stayed as the list's
footer row until Round 7, which moved them to the header), live filtering in the search field, a "+" for tasks, swipes, landscape (914 px keeps the docked sidebar), a real phone, the desktop app.

### Round 5 status: polish (2026-11-26)

Done in the working tree (nothing committed) and checked on the emulator after one build.

| # | What changed | Checked by |
|---|---|---|
| 20 | Every `:hover` rule that is a highlight sits in `@media (hover: hover)` (47 blocks in 20 SCSS files: 29 wrapped by a script, the rest by hand where a hover shared a rule with a state such as `--open` or `--active`). What stays outside it: the native scrollbar thumbs, and the "selected" and "active" overrides, which look the same as the state | A tap on Bold leaves `:hover` true but its background transparent (it was `rgba(27,29,36,.05)`); `matchMedia('(hover: hover)')` is false on the emulator. The compiled CSS of HEAD and of the tree, with the wrappers removed, has the same 1005 selector and declaration pairs |
| 23 | On a phone Edit opens the editor unfocused, as the note was read: no keyboard, the text from the top. The first tap in the text raises it. A new note ("+") is still focused | Edit: `activeElement` is the body, `mInputShown=false` (`47`); a tap in the text: TEXTAREA, keyboard up |
| 33 | The page tells `MainActivity` its theme (`window.grapheneBars.setDark`, a JavaScript interface; `lib/theme.ts` calls it whenever the theme is applied), and the bars' icons follow it, with a keep rule for release builds | Theme Dark on a light phone: light icons (`48`); Theme Light on a night-mode phone: `LIGHT_STATUS_BARS` in `dumpsys window`; Theme System follows a live switch of the phone's mode both ways |
| (Round 4 leftover) | Undo of a note's delete on the note's own screen goes back to that note; from the list it stays on the list | Both, on the emulator |

Not checked: the desktop app (the hover guard is plain CSS and is identical in structure; the bridge and the focus change are Android and phone only), a release build with R8, and a mouse on a tablet.

### Round 6 status: touch dragging (2026-11-26)

Done in the working tree and checked on the emulator after one build. The audit's "S" fix was already there: the task menu has "Move up" and
"Move down" (`TasksPane.tsx`, for the open tasks of a list's own view), as folders, lists, groups and notes do. The "L" fix is built:
a finger drags a row of the sidebar or the tasks, in the one place that all drags share (`useDragToFolder`).

How it works: a finger that rests on a row for 400 ms picks it up (the drag ghost shows above the finger). One that moves more than 10 px before
that is scrolling, and the browser keeps the touch. After the pick-up a blocking `touchmove` handler holds the scroll back (the browser would
otherwise cancel the pointer), and the row's long-press `contextmenu`, which comes at about 500 ms, is held back too. A finger that lifts without
having moved gets that menu then (a synthetic `contextmenu` on the row), so a long press still opens it. Near the top or bottom edge of the list
the list scrolls under the finger (`lib/dragScroll.ts`, with a test). A mouse and a pen take the old path unchanged.

| What | Checked by |
|---|---|
| A swipe over a row still scrolls, a tap still opens the note | scrollTop 0 to 258; the tap opened the note |
| Hold, lift: the menu | The ghost shows while held and no menu; after the release the menu opens |
| A note moved above another (manual order) | "Meeting sync" went before "Meeting pipeline", with the drop line on it (`49`) and no menu after the drop |
| A note dropped on a folder | The folder is tinted, the note is inside it afterwards |
| A folder moved above its sibling | "Test folder" before "Client Planning" |
| A task moved above another, in a list | "Move auth in" before "Merge backup not" (`50`); neither the menu nor the details opened |
| A to-do list moved to the top of the lists | "Roadmap" first |
| A long list: the finger at the bottom edge | The list scrolled from 184 to 1488 while held, and the drop landed at the line under the finger |
| A mouse | A drag started with Android's mouse input source shows the ghost and drops (the old path) |

Not done: a haptic tick on the pick-up (the ghost is the only cue), a lift animation on the row, moving a task to another list by drag (the lists are on
another screen on a phone: "Move to list" in the menu does it), a drag on a tablet with a pen, and a real phone. GitNexus rates `useDragToFolder` HIGH (the
sidebar and the tasks both use it): every new rule is behind `pointerType === "touch"`.

### Round 7 status: feedback on the phone build (2026-11-26)

Done in the working tree (nothing committed) and checked on the emulator after two builds. These are the points from a look at the build on a phone-sized screen.

| Point | What changed | Checked by |
|---|---|---|
| Settings and Trash did not sit well with the "+" | They are the last two buttons of the list's header (`PhoneActions`, rendered by `SidebarHeader` when `phone`): Trash with its count on the Notes tab, Settings on both. The sidebar footer draws nothing on a phone, except as the Trash drop zone while a note is held | Header on Notes: "Trash, 4 notes" and "Settings"; on Tasks: Settings only (`51`); the header's Trash opens the Trash view with its 4 notes; a note held for 400 ms shows "Drop to move to Trash" above the bottom bar (`56`) |
| The "+" did not fit the rest of the app | The text colour as its fill and the panel colour for the plus: black with a white plus in the light theme (`51`), a light circle with a dark plus in the dark one (`55`). It sits 16px from the bottom | Computed colours in both themes |
| A task's details were not full width, and their Back looked like the list's | Width: the slot `.tasks-pane__details` was 100% but the `.task-detail` inside it kept `--details-width` (320px), so both are 100% on a phone. The bar button is a left chevron "Back to the tasks" on a phone (a right chevron "Close details" elsewhere) | Slot and pane both 391px; the label read back (`53`) |
| Settings' close button at the bottom | A back arrow before the title, as in the other screens; the footer's Close is hidden on a touch screen. The arrow is not drawn on a computer | The arrow closes it, and so does the Back key (`52`) |
| The code language list opened under the UI and the keyboard | It is drawn on `document.body` and placed like a `Select`: under the chip cut to the room there, or above it when that is under 200px. The chip keeps the editor's focus with `onMouseDown` `preventDefault`, as the toolbar's buttons do. The bottom bar is hidden while the list is open | Keyboard up (window 578px): the list is 253px tall, its bottom 5px above the chip, the keyboard and the bar stay as they were, "ts" is preselected (`54`); picking "js" rewrote the fence and closed the list with the focus back in the text; a press outside closed it |

Two misses of mine, found by the feedback and by the check: the "391 px" for the details in Round 4 was the slot only (the pane inside was 320px, and `45` shows it), and the first build of the language list did not open at all with the keyboard up: tapping the chip took the editor's focus, the keyboard went, the bottom bar came back and moved the chip from under the finger before the tap ended (the click landed on `.app`). The rows above are measured after both fixes.

Vaults on a phone were built afterwards (Round 8). Not done: the "+" overlaps the right end of the Trash drop zone while a note is held (the zone is as wide as the screen, so most of it is free), a real phone, the desktop app, landscape. Seen, not investigated: leaving the app with Back ends in an Android `FORTIFY: pthread_mutex_lock called on a destroyed mutex` abort in the crash log (it is in every earlier exit too).

### Round 8 status: vaults on a phone (2026-11-27)

Done in the working tree (nothing committed) and checked on the emulator after three builds. The design is "Vaults on a phone" in plan 02 (agreed
2026-11-27): several private vaults in the app's own storage, each with an id that syncing can key on.

| Point | What changed | Checked by |
|---|---|---|
| More than one vault | `useVaults.create(name)` makes `vaults/<nanoid>` in the app's storage, with `.graphene/vault.json` holding the id (where plan 03's sync looks for it), adds the vault and opens it. `erase(path)` takes it off the list and deletes the folder; `remove` now says whether it went through. `deletePrivateVaultFolder` refuses anything outside the app's storage | "Work" made: two vaults in `config.json`, the new one active, `vault.json` has the folder's id; a note made in it is in its folder and not in `Notes`; the empty vault shows "Nothing here yet" |
| Switching | On Android the header's vault chip is always a button: the vaults (the open one checked) and "Manage vaults…", and no "Add vault…" (there is no folder to pick) | `58`; Work to Notes: 46 notes and Notes' own Trash (4), the open vault saved |
| Settings, Vaults | An Open tag once there are two; Open and Delete (Delete asks, and says the notes go with it); no Delete on the last vault; "New vault…" is a name field that refuses a name another vault has; renaming changes only the name | `57`, `59`, `60`; after a rename the folder is where it was; Cancel kept both vaults; deleting the open vault opened Notes, removed the folder, and logged no error |
| Touch sizes of those controls | Open and Delete were 32x20 and 38x20 px and the name 46x23: now 56x44 and 62x44, the name 40 high | Measured on the emulator |

A design change on the way: the id was first kept in `config.json`, which would have been a second id next to the `.graphene/vault.json` that plan 03 asks
for (and one per device, where a synced vault needs the same everywhere), so it lives in the vault only. `Notes`, the first vault, has no such file yet:
sync adds it when it links the vault.

Not done: putting the vaults in an order by hand, an icon or colour for a vault, moving a note between vaults, an export offered before a Delete (the
audit's #2 decides export), a real phone, the desktop app (its change is `remove` returning a boolean and the shape of the Vaults panel's JSX).
GitNexus rated `useVaults`, `addVault`, `VaultSwitcher` and `VaultsPanel` HIGH (the same 56 symbols each: likely one shared node) and `VaultEntry` CRITICAL, which was not changed in the end.

### Round 9 status: the Settings design (2026-11-27)

Asked for after Round 8: the phone's Settings looked clunky, and so did the desktop dialog next to the rest of the app. The direction (cards, one
line per setting, quieter chrome) was my call, not a mock-up the user chose from. In the working tree, nothing committed; the phone was checked on the
emulator after the build and then on a real phone (OnePlus CPH2493, Android 16, 354 x 792 dp, three-button navigation), the desktop
dialog only in a temporary browser harness (deleted).

| Point | What changed | Checked by |
|---|---|---|
| Settings in cards | Each section is cards (`.settings__group`) of settings (`.settings__field`): the name left and the control right on one line, a hint or a sample the full width under them, a hairline between the settings of a card | `61`, `62` |
| Desktop dialog | 760 x 600 px, the section list on a tinted column, the section's title and a ✕ in one header instead of a footer with a Close button, no rule under the header (the body fades out under it as it scrolls), a lighter hairline all round | Harness: light and dark, the four sections |
| Phone | One flat surface: the sections are text tabs with a line under the open one, the cards sit on the page, segmented controls fill the width and are 44 px tall, the body ends 16 px above the system bar (its inset plus 16) | `61`, `63`; Appearance, Vaults, About, light and dark |
| Narrow | `.settings__main` is a container: under 480 px wide the segmented controls and dropdowns go under their name (the phone is always that narrow) | The phone; a narrow desktop window was not tried |
| A link was a bad target | "View on GitHub" was 90 x 19.5 px: now 44 px tall and as wide as it needs, flush with the card's edge, the row still 49 px | Measured on the emulator, before and after |
| Four options on a 354 dp phone | Code font's four options need 314 px and the control has 284: "Custom" ran off the card. Under 480 px wide the options have 8 px of side padding (14 before) and take a second row if that is still too wide (larger text was simulated: Custom drops to a row of its own) | The real phone, before and after: `64` |
| The end of a long section | The body's bottom padding was `max(24px, inset)`: with a 3-button bar (inset 44 px) that is the bar's own height, so the last card sat on the bar. It is now the inset plus 16 px | The real phone: the last card ended at 748 px, the bar's top, before and 732 after: `65` |

The emulator is 411 dp wide with a gesture bar, so neither of the last two rows showed there; the real phone found both.

Not done: the desktop app itself (only the harness), the AI assistants section with real MCP data (its card was seen with the stub only),
a narrow desktop window. GitNexus rated `SettingsDialog` and the panels HIGH (the same 56 symbols and 22 flows: the shared-node artifact again);
their only callers are `App.tsx` for the dialog and the dialog for the panels.
A note on method: `closelayers` in my test helper pressed Back at the list root, which exits the app and shows the WebView FORTIFY abort from Round 7:
that, not a crash, was what stopped the first launches of this round.

## 4. Method, conditions and limits

**Method.** A synthetic vault (about 40 notes in nested folders from `scripts/gen-synthetic-vault.mjs`, plus hand-made cases: a very long note,
a wide table, a long unbroken line, an image, a checklist, a 300-line code note, a 60-character title) and three task lists with a group,
steps, due dates and Important / My Day flags, in the app-private vault. Flows were driven by `adb` taps, swipes and long presses (900 ms),
with the Back key through `adb shell input keyevent 4`. Measurements: Chrome DevTools over `adb forward` to the WebView, read-only
`Runtime.evaluate` for element sizes (`getBoundingClientRect`, `elementFromPoint`), `visualViewport`, computed fonts and colours, and the
`:hover` state after a tap. Screenshots by `adb screencap`, scaled to 540 px wide (900 for the landscape one).

**Conditions.** Default 411x914 dp light (every screen). Dark theme (drawer, note, tasks; contrast measured). Small phone 360x640 dp
(`wm size 720x1280`, `wm density 320`): drawer, note, editor with keyboard, tasks, details, Settings. System font 1.3x (drawer, note, Settings).
Landscape: read view and editor with the keyboard.

**Checked, fine.**

- Data safety on Home: autosave reaches the disk while the app is in the background.
- Light theme contrast: 0 failures on the drawer, a note and the tasks.
- The search palette, the long-press menus (44 px rows), the sort menu, the More-actions menu (Duplicate / Move to trash) and the folder picker items.
- Text selection in the read view works with a long press.
- Long unbroken words and URLs wrap; code with line numbers and wrapping reads well; the Trash view layout.
- The landscape read view (docked 252 px sidebar plus the note); rotation and dark-mode changes keep the state.
- The Back key closes the newest open menu, dialog or pane in the right order (the audit relied on it throughout; #13 is the one gap).
- Tasks: adding with the keyboard up, the long-press menu (44 px rows).
- One lead did not reproduce: the editor's "More actions" menu seemed not to open on my first tap; it opens on a retest, and the first tap
  most likely hit a neighbouring button (#3).

**Not checked.**

- A real phone: real touch feel, OEM keyboards (Gboard only here), one Android version only (API 37), a debug build, no TalkBack run
  (accessibility was judged from labels, contrast and target sizes only).
- Split-screen; the process killed mid-edit (`am kill`) beyond the Home test; double-tap zoom, overscroll glow, haptics.
- The language picker, the conflict banner, the error boundary, toasts against the gesture bar and the keyboard, the delete-confirm bar by touch.
- Dark theme for Settings and the editor; the small-phone Trash and Search; a display cutout in landscape.
- Whether Gboard's own undo reaches the editor (#6), whether a task can be moved to another list by touch (#7).

**Harness note.** The Back key at the root exits the app by design, and the audit script exited it three times by pressing Back too often.
These are not findings.

**Emulator state.** Size, density, font scale, theme and rotation were reset at the end. The seeded test vault is still in the emulator's
app data.

## 5. Screenshots

| # | File | Shows | Finding |
|---|---|---|---|
| 01 | [01-editor-keyboard-pan.png](android-2026-11-26/01-editor-keyboard-pan.png) | Editor on a long note, keyboard up: header and toolbar gone, clock over the text | #1 |
| 02 | [02-editor-keyboard-pan-small-phone.png](android-2026-11-26/02-editor-keyboard-pan-small-phone.png) | Same on 360x640 dp | #1 |
| 03 | [03-editor-keyboard-landscape.png](android-2026-11-26/03-editor-keyboard-landscape.png) | Same in landscape: about five lines of text | #1 |
| 04 | [04-editor-toolbar-cut-off.png](android-2026-11-26/04-editor-toolbar-cut-off.png) | Toolbar with the caret high: five buttons off-screen, no cue | #6 |
| 05 | [05-read-header-squeezed.png](android-2026-11-26/05-read-header-squeezed.png) | Read view, long title: chip and buttons squeezed | #3 |
| 06 | [06-table-squeezed.png](android-2026-11-26/06-table-squeezed.png) | A table crushed into the column | #8 |
| 07 | [07-drawer-task-rows-28px.png](android-2026-11-26/07-drawer-task-rows-28px.png) | Tasks drawer: list rows at 28 px | #9 |
| 08 | [08-drawer-keyboard-over-list.png](android-2026-11-26/08-drawer-keyboard-over-list.png) | Notes drawer over the draft editor; deep titles truncated | #12, #26 |
| 09 | [09-task-details-pane.png](android-2026-11-26/09-task-details-pane.png) | Task details pane over the list | #17 |
| 10 | [10-task-calendar.png](android-2026-11-26/10-task-calendar.png) | Due-date calendar | #17 |
| 11 | [11-settings-phone-width.png](android-2026-11-26/11-settings-phone-width.png) | Settings at 411 dp | #4, #24 |
| 12 | [12-settings-code-font-clipped.png](android-2026-11-26/12-settings-code-font-clipped.png) | Code font control clipped | #4 |
| 13 | [13-settings-vaults.png](android-2026-11-26/13-settings-vaults.png) | Vaults panel overflowing | #2, #10 |
| 14 | [14-settings-about.png](android-2026-11-26/14-settings-about.png) | About: no word on app-private storage | #2 |
| 15 | [15-folder-picker-clipped.png](android-2026-11-26/15-folder-picker-clipped.png) | Folder picker running off the right edge | #16 |
| 16 | [16-sticky-hover.png](android-2026-11-26/16-sticky-hover.png) | Drawer toggle still highlighted after a tap | #20 |
| 17 | [17-dark-note.png](android-2026-11-26/17-dark-note.png) | Dark theme, note | #31 |
| 18 | [18-dark-drawer.png](android-2026-11-26/18-dark-drawer.png) | Dark theme, drawer | #21 |
| 19 | [19-small-phone-drawer.png](android-2026-11-26/19-small-phone-drawer.png) | Drawer on 360x640 dp | #19 |
| 20 | [20-small-phone-settings.png](android-2026-11-26/20-small-phone-settings.png) | Settings on 360x640 dp | #4 |
| 21 | [21-font-scale-settings.png](android-2026-11-26/21-font-scale-settings.png) | Settings at system font 1.3x | #4 |
| 22 | [22-long-press-folder-menu.png](android-2026-11-26/22-long-press-folder-menu.png) | Long-press menu on a folder (works well) | #30 |
| 23 | [23-search-palette.png](android-2026-11-26/23-search-palette.png) | Search palette (works well) | section 1 |
| 24 | [24-cold-start-blank-draft.png](android-2026-11-26/24-cold-start-blank-draft.png) | Cold start: blank draft editor | #11 |
| 25 | [25-trash.png](android-2026-11-26/25-trash.png) | Trash view | #25 |
| 26 | [26-read-checklist.png](android-2026-11-26/26-read-checklist.png) | Checklist in the read view | #14, #28 |
| 27 | [27-read-code.png](android-2026-11-26/27-read-code.png) | Code in the read view (works well) | section 1 |
| 28 | [28-task-add-keyboard.png](android-2026-11-26/28-task-add-keyboard.png) | Adding a task with the keyboard up (works well) | #1, section 1 |
| 29 | [29-touch-drag-no-effect.png](android-2026-11-26/29-touch-drag-no-effect.png) | After a touch drag of a note onto a folder: nothing moved | #7 |
| 30 | [30-launcher-default-icon.png](android-2026-11-26/30-launcher-default-icon.png) | The app list: Graphene with the default Tauri icon | #29 |
| 31 | [31-forced-dark-status-bar.png](android-2026-11-26/31-forced-dark-status-bar.png) | Theme set to Dark on a light phone: dark status bar icons on the near-black frame | #33 |
| 32 | [32-launcher-new-icon.png](android-2026-11-26/32-launcher-new-icon.png) | The app list after Round 1: Graphene with the logo icon | #29 |
| 33 | [33-editor-keyboard-default.png](android-2026-11-26/33-editor-keyboard-default.png) | Round 2: editor with the keyboard up, default phone; header on top, toolbar on the keyboard | #1, #6 |
| 34 | [34-editor-keyboard-small.png](android-2026-11-26/34-editor-keyboard-small.png) | Round 2: the same on the small phone (326px window) | #1 |
| 35 | [35-editor-keyboard-landscape.png](android-2026-11-26/35-editor-keyboard-landscape.png) | Round 2: landscape with the keyboard up, title bar hidden, about 3 lines and the row | #1 |
| 36 | [36-editor-toolbar-scrolled.png](android-2026-11-26/36-editor-toolbar-scrolled.png) | Round 2: the row scrolled to Outdent and Indent; fade at the left | #6 |
| 37 | [37-settings-full-screen.png](android-2026-11-26/37-settings-full-screen.png) | Round 3: Settings as a full screen, sections as tabs, Close at the bottom | #4 |
| 38 | [38-settings-vaults-private.png](android-2026-11-26/38-settings-vaults-private.png) | Round 3: the Vaults tab with the one vault and the notice | #2, #10 |
| 39 | [39-table-scrolled.png](android-2026-11-26/39-table-scrolled.png) | Round 3: the wide table scrolled to its last columns | #8 |
| 40 | [40-settings-small-phone.png](android-2026-11-26/40-settings-small-phone.png) | Round 3: Settings on the small phone | #4 |
| 41 | [41-phone-list-undo.png](android-2026-11-26/41-phone-list-undo.png) | Round 4: the list screen with the search field, "+", bottom bar and the Undo bar after a delete | #11, #19 |
| 42 | [42-phone-note-screen.png](android-2026-11-26/42-phone-note-screen.png) | Round 4: a note with the back arrow and the bottom bar | #3 |
| 43 | [43-phone-note-menu.png](android-2026-11-26/43-phone-note-menu.png) | Round 4: the note's "..." menu with Move to | #3 |
| 44 | [44-phone-tasks-screen.png](android-2026-11-26/44-phone-tasks-screen.png) | Round 4: a task list as a screen | #11 |
| 45 | [45-phone-task-details.png](android-2026-11-26/45-phone-task-details.png) | Round 4: a task's details, full width | #17 |
| 46 | [46-phone-list-small-dark.png](android-2026-11-26/46-phone-list-small-dark.png) | Round 4: the list on the small phone and in the dark theme | #19 |
| 47 | [47-editor-opens-without-keyboard.png](android-2026-11-26/47-editor-opens-without-keyboard.png) | Round 5: Edit opens the editor with no keyboard | #23 |
| 48 | [48-dark-theme-light-phone-status-bar.png](android-2026-11-26/48-dark-theme-light-phone-status-bar.png) | Round 5: Theme Dark on a light phone, with light status bar icons | #33 |
| 49 | [49-touch-drag-note.png](android-2026-11-26/49-touch-drag-note.png) | Round 6: a note held and moved, with the drop line and the Trash zone | #7 |
| 50 | [50-touch-drag-task.png](android-2026-11-26/50-touch-drag-task.png) | Round 6: a task held and moved | #7 |
| 51 | [51-phone-list-header-actions.png](android-2026-11-26/51-phone-list-header-actions.png) | Round 7: Trash and Settings in the list's header, the black "+" | #19 |
| 52 | [52-settings-back-arrow.png](android-2026-11-26/52-settings-back-arrow.png) | Round 7: Settings with a back arrow and no Close | #4 |
| 53 | [53-task-details-full-width.png](android-2026-11-26/53-task-details-full-width.png) | Round 7: a task's details at the full width, with a left chevron | #17 |
| 54 | [54-code-language-above-keyboard.png](android-2026-11-26/54-code-language-above-keyboard.png) | Round 7: the language list above the chip, keyboard up | #1 |
| 55 | [55-phone-list-dark-plus.png](android-2026-11-26/55-phone-list-dark-plus.png) | Round 7: the list in the dark theme, the light "+" | #19 |
| 56 | [56-phone-drag-trash-zone.png](android-2026-11-26/56-phone-drag-trash-zone.png) | Round 7: a note held, with the Trash drop zone in the footer | #7 |
| 57 | [57-vaults-two.png](android-2026-11-26/57-vaults-two.png) | Round 8: Settings, Vaults with two vaults, Open and Delete as finger-sized links | #2 |
| 58 | [58-vault-menu.png](android-2026-11-26/58-vault-menu.png) | Round 8: the header chip's menu: the vaults and Manage vaults | #2 |
| 59 | [59-new-vault-name-taken.png](android-2026-11-26/59-new-vault-name-taken.png) | Round 8: a new vault's name field refusing a name that is taken | #2 |
| 60 | [60-vault-delete-confirm.png](android-2026-11-26/60-vault-delete-confirm.png) | Round 8: Delete asks, and says the notes go with the vault | #2 |
| 61 | [61-settings-appearance-cards.png](android-2026-11-26/61-settings-appearance-cards.png) | Round 9: Settings, Appearance: text tabs, cards, full-width controls | Settings |
| 62 | [62-settings-about-cards.png](android-2026-11-26/62-settings-about-cards.png) | Round 9: Settings, About: one card of settings, the link as tall as a finger | Settings |
| 63 | [63-settings-appearance-dark.png](android-2026-11-26/63-settings-appearance-dark.png) | Round 9: Settings, Appearance in the dark theme | Settings |
| 64 | [64-phone-settings-appearance.png](android-2026-11-26/64-phone-settings-appearance.png) | Round 9: a real phone (354 dp): Code font's four options fit | Settings |
| 65 | [65-phone-settings-bottom.png](android-2026-11-26/65-phone-settings-bottom.png) | Round 9: a real phone: the end of Appearance, the last card above the bar | Settings |
