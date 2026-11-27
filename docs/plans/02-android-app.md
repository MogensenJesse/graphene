# Android app

Status: plan, started 2026-11-26. The app runs on the Android emulator (API 37) with its own default vault, no window buttons and safe-area
padding, and the soft keyboard works with the editor there (not yet tried on a phone). Touch: bigger targets, no tips or key hints, long-press menus (they already worked), a phone-sized header and the Back key (it closes the newest open menu, dialog or pane, and leaves the app when
none is open), the app icon, the first round of audit fixes, the editor's keyboard fix (the page's window ends at the keyboard, a formatting row on top of it with undo, redo, indent and outdent) Settings as a full screen with the one private vault shown as a name and a warning that uninstalling deletes the notes, the phone navigation (a full-screen list as home, a bottom bar, Back from a screen to the list, a "+" for a new note; see "Phone navigation") a polish round (hover styles only where a mouse hovers, status-bar icons that follow the app's Theme, Edit opening without the keyboard) and dragging by touch (rest a finger on a row, then move it) are done; the list's `[...]` menu, a live search field, the real-phone test and the APK signing are still to do. A UI and UX audit of the emulator build (2026-11-26, 32 findings) is in `docs/audits/2026-11-26-android-ui-ux-audit.md`. Written 2026-11-21.

Related plan: [03-cloud-sync-and-collaboration.md](03-cloud-sync-and-collaboration.md). The audit-fix plan that these plans used to point at is done and was removed from the tree; it is in commit `7df88a1` (`git show 7df88a1:docs/plans/01-audit-fixes.md`), and AGENTS.md keeps its startup numbers and open items.

Evidence markers used below: **[V]** verified against a current source on 2026-11-20, **[M]** from memory or an estimate,
**[C]** read in this repository.

## Goal and scope

An Android app for Graphene's notes and tasks. First version: the **free tier**, which means the notes and tasks live on the phone,
there is no account and nothing syncs. The paid tier (sync and collaboration, see document 03) later runs on this same app.

Out of scope for now: the Play Store, automatic updates, background sync, a home-screen widget, iOS.

## Decisions made

- **Platform:** Android first. iOS comes later and reuses the same approach.
- **Minimum version:** Android 12 (API 31), so set `minSdkVersion` to 31. It is about five years old and a comfortable floor for the
  WebView features the UI uses.
- **Distribution:** sideloaded APK only, because this is the testing phase. No Play Store listing, and no in-app updater: each
  release is a new APK (for example attached to the GitHub release) that the tester installs over the old one.
- **Sync:** none on the free tier. On the paid tier, only while the app is open.
- **Shell:** Tauri 2 on Android, one codebase with the desktop app.

## Why Tauri 2

- Tauri 2.0 went stable in October 2024; a mid-2026 write-up still calls mobile the less mature path, and the 2.12 release notes
  (September 2026) list Android crash and permission fixes [V]. So it works, but expect rough edges.
- Reuse is high [M, from line counts]: about 2.6k of the 3.5k lines in `src/lib` are pure TypeScript and move over unchanged, and
  roughly 80% of the React UI carries over once the touch changes below are made.
- The repository is already partly ready [C]: `Cargo.toml` guards the updater, window-state and single-instance plugins with
  `cfg(not(any(target_os = "android", target_os = "ios")))`, and `lib.rs` has `#[cfg_attr(mobile, tauri::mobile_entry_point)]`.

Rejected alternatives (reuse estimates are mine [M]):

| Option | Reuse of `src/lib` | Reuse of the UI | Why not |
|---|---|---|---|
| Capacitor | about 100% | about 80% | A second shell next to Tauri; its Filesystem plugin has no folder-tree access either [V] |
| React Native / Expo | about 90% | about 10% | The DOM, SCSS, textarea editor and react-markdown would all be rewritten |
| Kotlin / Compose | 0% (a port) | 0% | The merge logic would exist twice, which invites divergence |
| PWA | about 100% | about 85% | Folder access on Android unverified, and no store presence without a wrapper |

Keep a thin platform adapter (file access, focus and lifecycle, share, updater) so that swapping the shell for Capacitor stays a
one-to-two-week hedge [M].

## Where the notes live: an app-private vault

On the desktop a vault is any folder the user picks. That does not carry over to Android:

- The official dialog plugin has **no folder picker on Android** [V].
- Android's Storage Access Framework (SAF), the only way to reach an arbitrary folder, is very slow for many small files. Developers
  report 100 to 500 times slower than a single query (anecdotal) [V], and the official fs plugin documents no way to list a SAF
  tree [V]. Graphene's focus rescan reads every file, so it would suffer.
- The community plugin `tauri-plugin-android-fs` offers a SAF folder picker, but it is unofficial and has had many breaking
  versions [V].

So the Android app keeps its vault in **app-private storage**: real file paths, fast, no permission prompts. The folder layout is
the same as on the desktop (`.md` files with frontmatter, `.tasks/`, `.trash/`, `attachments/`), so the pure code, the scan and the
future sync engine work unchanged.

Consequences:

- A first launch creates a default vault (`Notes`) automatically. There is no vault picker. More vaults (built 2026-11-27, see "Vaults on a phone" below) are named, empty and private: `vaults/<id>` in the same storage.
- Getting notes in and out is by import and export (and the share target below). An optional SAF mirror can come later.
- The phone's notes are not visible to other apps. That is a privacy plus, and it is also why export matters.

## What works on Android and what does not

| Piece | Android | What to do |
|---|---|---|
| dialog, clipboard-manager, opener | work [V] | keep; do not rely on a folder picker |
| fs | works with access limited to the app folders [V] | scope it to the app-data directory, which is where the vault lives |
| deep-link | works [V] | needed later for sign-in, see document 03 |
| updater | not available [V] | already `cfg`-guarded; hide `useUpdater`, `UpdateDialog` and the About "check for updates" on Android |
| window-state, single-instance | not available [V] | already guarded |
| `WindowControls`, `data-tauri-drag-region` | not applicable | do not render them on mobile |
| `getCurrentWindow().onFocusChanged` (used by `useVaultRefresh`, `useTasks`, `App`) | not meaningful | replace with the page `visibilitychange` event and the app lifecycle |
| Settings > AI assistants | the MCP server is a desktop, stdio tool | hide that tab on Android |

WebView notes: the CSS Custom Highlight API (used by find-in-note) is Baseline 2025 [V]; container queries, `inert`, `showPicker`
and `backdrop-filter` are fine on current WebViews [M]. The acrylic window and custom title bar do not exist on Android.

## Interface changes for touch

The app is built for mouse and keyboard today, so these are real work, not polish:

- **Sidebar becomes a drawer.** It already floats over the note below 800 px [C]; add a swipe-in gesture and a visible menu button.
  On a phone this is replaced by "Phone navigation" below (a full-screen list instead of a drawer); the floating drawer stays for 600 to
  800 px.
- **Right-click menus become long-press plus visible "..." buttons.** There are about 26 `onContextMenu` sites [C] and no hover
  actions on note rows.
- **Drag and drop:** the menus have "Move to..." and "Move up / Move down" for notes, folders, tasks, lists and groups. **Touch dragging done
  2026-11-26** (audit #7): a finger that rests on a row for 400 ms picks it up, and one that lifts without moving gets the row's menu, so a
  long press still opens it. See "Round 6" in the audit for how it works and what was checked.
- **Soft keyboard:** **done 2026-11-26** (audit #1 and #6): the textarea editor stays above the keyboard, with the formatting toolbar
  sitting just above it. `MainActivity` pads the content view by the IME inset; the `interactive-widget` meta was not tried (a runtime
  change of it did nothing, and the WebView does not resize by itself). Landscape with the keyboard up leaves about 3 lines (the title
  bar and word count hide while typing). One Tauri Android report found `visualViewport` did not change and `adjustResize` did not help, and needed a Kotlin
  window-insets fix [V, single report], so treat this as the riskiest item. Also check that `execCommand`-based undo works in the
  Android WebView [M].
- **Targets and tooltips:** 44 px minimum touch targets; tooltips do not exist on touch, so labels must not depend on them.
- **Share target** ("Save to Graphene" from other apps): via a community share-target plugin or a small Kotlin intent filter [V].
  Useful, but after the basics.
- **Quick capture and widgets:** native Kotlin writing into an inbox note. Deferred.

## Phone navigation (built 2026-11-26, except the `[...]` menu, a live search field and a Tasks "+"; see "Built")

The drawer is a desktop idea made to fit: on a phone the main actions (Notes | Tasks, Search, New note) are rows at the top of a panel
that covers 61% of the screen, the header carries the title, a folder chip and three buttons, and the first screen at launch is a blank
draft. The UI and UX audit (`docs/audits/2026-11-26-android-ui-ux-audit.md`) traces #3, #11, #12, #15, #19 and #26 to this. The proposal:
the app works as a few full screens, with the main actions in the thumb's reach.

The screens, on a touch screen narrower than about 600 px (`pointer: coarse`, so a narrow desktop window keeps the drawer; from 600 to
800 px the floating drawer stays, and from 800 px the docked sidebar):

```
1. LIST SCREEN (home): Notes tab
┌────────────────────────────────┐
│ Graphene               [ ... ] │   [...] = Settings, Trash, Vaults
│ ┌────────────────────────────┐ │
│ │ Search notes               │ │   search field always visible
│ └────────────────────────────┘ │
│ 46 notes              Manual v │
│ v Client Planning              │
│   v Team Journal               │
│     [ ] Questions about retro  │
│     [ ] Meeting pipeline       │
│   [ ] Summary of atlas         │
│ [ ] Log design                 │
│ [ ] Checklist sprint           │
│                                │
│                        (  +  ) │   a new note, straight away
├────────────────────────────────┤
│     NOTES      |     TASKS     │   bottom bar, in thumb reach
└────────────────────────────────┘

2. NOTE SCREEN (reading)               3. The [...] menu of a note
┌────────────────────────────────┐   ┌────────────────────────────────┐
│ <  Quarterly pl...  Edit [...] │   │ <  Quarterly pl...  Edit [...] │
├────────────────────────────────┤   │             ┌────────────────┐ │
│ Quarterly planning             │   │             │ Copy note      │ │
│ A long note to scroll through. │   │             │ Folder: None  >│ │
│ Section 1                      │   │             │ Move to...     │ │
│ Paragraph one of section 1...  │   │             │ Duplicate      │ │
│ - [ ] A task inside the note   │   │             │ Find in note   │ │
│ Edited today . 1665 words      │   │             │ Move to trash  │ │
├────────────────────────────────┤   │             └────────────────┘ │
│     NOTES      |     TASKS     │   └────────────────────────────────┘
└────────────────────────────────┘

4. EDITOR (keyboard up)
┌────────────────────────────────┐
│ <  Quarterly pl...        Done │   the top bar stays on screen
├────────────────────────────────┤
│ ...the quick brown fox jumps   │
│ keeps going so the line|       │
├────────────────────────────────┤
│ B I S | H1 H2 | - 1. [ ] | > ` │   the toolbar sits just above the keyboard,
│ undo redo | indent outdent | ..│   scrolls sideways, has undo, redo and indent
├────────────────────────────────┤
│        (the keyboard)          │
└────────────────────────────────┘

LIST (home) ──tap a note──> NOTE ──Edit──> EDITOR
    ^                         |              |
    |<───── Back / "<" ───────┘              |
    |<───────── Done, then Back ─────────────┘
Back on the list leaves the app, as Back does today.
```

The Tasks tab works the same way: its list screen shows Search, My Day, Important and the lists; a list opens as a screen (today's Tasks
pane), and a task's details as one more screen above it, each with Back and the bottom bar.

**Built (2026-11-26, in the working tree):** on a touch screen under 600 px (`PHONE_QUERY` in `App.tsx`; `pointer: coarse`, so a narrow
desktop window keeps the drawer, and landscape, at 914 px, keeps the docked sidebar) the sidebar is the list screen: it fills the body
(`app__sidebar--screen`), is where the app starts, and the note, the editor, the Trash, the tasks and a task's details are screens above it
(`compactOpen` means "the list is showing"). Back goes from a screen to the list (`useBack(showList, phone && !compactOpen)`) and, on the
list, leaves the app. Notes | Tasks is a bottom bar on the list and on every screen (`BottomBar`; each tab goes to that tab's list; hidden
while a field has the focus), the back arrow replaces the sidebar toggle, a round "+" (`NewFab`, black with a white plus in the light theme, the reverse in the dark one) starts a note, Trash and Settings are at the end of the
list's header (`PhoneActions`; the sidebar footer draws nothing on a phone, except as the Trash drop zone while a note is dragged), Search is the one row left
above the list (a field that opens the palette), and the note's folder chip is gone: "Move to" is in its "..." menu (the title has about 130 px
more). The Undo bars sit above the list (the list takes over after a delete). A task's details are full width (the slot and the pane inside it) and their bar button is a left chevron, so it does not look like the list's
Back. The effect that closed the
drawer on every selection is off on a phone: a screen is entered by an explicit `closeFloating()` (pick, new, edit, Trash, search, a task
list), so a screen can also open the list over itself without being closed again. Checked on the emulator (default, small, dark; Back through
note, editor and keyboard; the Trash; task lists and details; cold start on the last tab): screenshots `41` to `46` in the audit; the header actions,
Settings' back arrow, the full-width details and the language list above the keyboard are `51` to `55`. Settings itself was redesigned afterwards, on a
phone and on a computer (cards of settings, text tabs on a phone; audit Round 9, `61` to `63`).

**Left from the proposal:** the list's `[...]` menu (Settings and Trash are buttons in the list's header now; the vault chip is a menu of the
vaults and "Manage vaults…" now: see "Vaults on a phone"), a search field that filters in place (it opens the palette), a "+" on the Tasks list
screen (the lists screen keeps its own "+" for a list and a group, and a task is added inside a list), and swipes.

**Tried on a real phone (2026-11-27):** a OnePlus (Android 16, 354 x 792 px, three-button bar, system font 90 %) over USB. The audit is
`docs/audits/2026-11-27-android-phone-audit.md`. Its findings were popups placed for the window and not for what a finger reaches (menus under the
navigation bar, submenus off the left edge, a calendar and a dropdown closed by the keyboard), targets of 36 to 40 px and a text menu on top of the
text. They are fixed in Round 10 of that file: `src/lib/popoverBounds.ts` places every popup inside what the page can show, targets are 44 px, and
the small text is a step larger.

**Vaults on a phone (built 2026-11-27):** a phone can have several vaults, all private (no folder picker: Android hands a picked folder over as a
`content://` address, and the vault code reads real paths; all-files access is restricted on Google Play). The first is `Notes`, the others are
`vaults/<id>` in the app's storage, where `<id>` is a `nanoid` that is also written to `.graphene/vault.json` inside the vault: the id that
docs/plans/03's sync keys a vault by, so a rename, or a vault copied to another device, keeps its identity (`Notes` gets its file when sync links it).
The header's vault chip lists the vaults and "Manage vaults…"; Settings, Vaults has Open, Delete (the folder and its notes go, after a confirmation;
never the last vault) and "New vault…" (a name, refused when taken). Not done: ordering the vaults by hand, a vault's icon or colour, moving a
note between vaults, and an export before a Delete (audit #2 is where export is decided).

**Decided (2026-11-26):**

- The bottom bar (Notes | Tasks) is on the note screen too, not only on the list.
- "+" makes a new note straight away, with no menu: code notes are not something people make on a phone. "New code" and "New folder" are
  not on the button; they stay in the list's `[...]` menu and the folder row, so nothing is lost.
- A cold start shows the list on the tab that was used last (`SIDEBAR_TAB_KEY` is already saved), not a blank draft and not the last note.

**What it settles in the audit:** #11 (the first screen), #15 (no drawer to swipe; the system Back gesture is the way back), #26 (the full
width for titles), #19 (the Search / New note / New code block it concerns goes away on a phone), #12 (the list is not under the
keyboard), and #3 for good (Copy, folder and the other header buttons move into `[...]`, so the title has room). It goes with #1 and #6
(the editor's top bar and toolbar stay visible above the keyboard). Not affected: #7 (touch drag and task order), #9 and #10.

**What it needs:**

- A phone layout mode in `App.tsx` (the `COMPACT_QUERY` / `floating` logic): the list screen is the `Sidebar` content at full width as the
  main view, not an overlay, so `SidebarToggle`, the scrim and `compactOpen` are not used there; a note, the editor, the Trash and the
  Settings are screens above it.
- A bottom bar component, a search field in the list (the palette stays for the other layouts), the "+" button, and a `[...]` menu of
  the list screen (Settings, Trash, Vaults, New code, New folder).
- A note header for the phone: a back arrow in place of the toggle, the title, Edit or Done, and one `[...]` menu that holds `moreEntries`,
  Copy and the folder (the chip goes). `useBack` registers the note and editor screens, so Back goes note to list and list out of the app.
- The tasks screens: the Tasks pane and the details pane as full screens (the details pane already floats below 739 px).
- Verified on the emulator in the default, small, landscape and 1.3x font conditions, as the audit was.

**Still open:**

- What "+" does on the Tasks list screen: add a task (to the last used list) or make a new list.
- The exact contents of the list screen's `[...]` menu, (the vault switcher is the header chip's menu: decided and built with the vaults).
- Whether the bottom bar hides while the keyboard is up (the editor needs the room; it probably must).
- Swipe between the two tabs, or from the note edge for Back: after the basics.

**Order of work:** the editor first (done 2026-11-26: the keyboard resize, the toolbar above the keyboard with undo, redo and indent: audit #1 and
#6, independent of the rest); then the list as home with the bottom bar, the Back model, the note header and the "+" button (done 2026-11-26,
without a `[...]` menu); what is left is the list's `[...]` menu, the search field and a Tasks "+", and none of them blocks the rest.

## Code changes outside the UI

- Create the vault in app-private storage on first run; skip the vault picker and `allow_vault_folders` on mobile.
- A platform adapter for the few desktop-only calls above (focus and lifecycle, updater, window controls).
- The Rust `scan_vault` command (`src-tauri/src/vault_scan.rs`) works on Android unchanged: it uses plain paths in
  the private vault, so it avoids the SAF slowness entirely.
- The data-safety fixes (write-new-then-delete-old, atomic writes; done in the audit work) matter even more on a phone, where the app
  can be killed at any moment.

## App icon

Done 2026-11-26. The launcher icon was Tauri's default (`src-tauri/icons/` had no `android` folder). It is now the logo,
`src-tauri/icons/app-icon.svg` (the hexagon, a light grey outline on transparent), on the app's near-black (`#0f1013`). An Android
adaptive icon is 108 dp with only the middle 66 dp always visible, so the foreground layer (`app-icon-fg.svg`) draws the hexagon at 68%
of the logo's size: `android_fg_scale` in the manifest did not shrink it, and at full size the launcher's mask cut it to a black hexagon.

- `src-tauri/icons/icon-manifest.json` (with `app-icon-fg.svg` as `android_fg` and `app-icon-bg.png`, a solid dark square, as `android_bg`,
  so the old flat and round icons are dark too) is the input of `tauri icon`. Run `npx tauri icon src-tauri/icons/icon-manifest.json -o <a scratch folder>` and copy
  only that folder's `android/` over `src-tauri/icons/android` and `src-tauri/gen/android/app/src/main/res`. The same command rewrites
  the desktop and iOS icons, which are left alone (the two desktop icons compared came out identical).
- `src-tauri/gen/android` is now kept in git, because the manifest and the icons are edited by hand (see AGENTS.md).
- Not done: a monochrome layer for the themed icons of Android 13 and later (`android_monochrome` in the manifest), and a look at the
  Recents card and the Android 12 start screen (it shows the app icon) on a real phone.

## Build, sign and sideload

These steps follow Tauri's Android documentation; the exact flags should be confirmed when the project is initialised [M].

1. `tauri android init`, then set `minSdkVersion` 31 in the generated Gradle project.
2. Build a release APK with `tauri android build --apk` (the Play Store flow uses an `.aab`; Tauri derives the `versionCode` from the
   app version [V]).
3. Sign it with a keystore kept outside the repository, the same way the updater's private key is kept (`%USERPROFILE%\.tauri\`).
   CI would use secrets; do not commit the keystore or its password.
4. Add a CI job beside `.github/workflows/release.yml` that builds the APK on a `v*` tag and attaches it to the draft release (needs
   the Android SDK and NDK on the runner). Until then, build locally.
5. Install on a test phone with `adb install -r graphene.apk`, or download the APK and allow "install unknown apps" for the browser.
6. Keep the Android app id stable. Google's developer verification for sideloaded apps started in Brazil, Indonesia, Singapore and
   Thailand on 2026-09-30 and goes global in 2027, with a limited-distribution account for up to 20 devices [V]. Register the app id
   before the testing circle grows.

When the Play Store comes later: a new personal developer account needs a closed test with 12 testers for 14 days, and an
organisation account is exempt [V]. F-Droid is plausible because the repository is Apache-2.0 [M].

## Risks

- **Soft keyboard and the editor** (above): done on the emulator; still to try on a real phone (other keyboards, IME animation, split-screen).
- **Tauri on Android is the less mature path.** Budget time for plugin and permission surprises, and keep the platform adapter thin.
- **No background sync.** Changes only sync while the app is open (a deliberate choice for now).
- **App-private storage** means uninstalling the app deletes the notes unless they were exported or synced. Say so in the UI.
- **Sideloading friction** for testers (install-unknown-apps prompts, developer verification from 2026-09-30 in some regions).

## Verification checklist (on a real Android 12 or newer device)

- Fresh install: the default vault is created, a note and a task can be created, edited, moved and trashed with Undo.
- Typing in a long note with the keyboard open: the caret stays visible, the toolbar sits above the keyboard, undo and redo work.
- Kill the app mid-edit and reopen: no lost or duplicated notes (this exercises the data-safety fixes).
- Open a note from the list, go back with Back and with the arrow, use long-press menus, use "Move to...", and use Search.
- Rotate, split-screen and switch apps: the layout holds and the state survives.
- A 1,000-note vault: cold start and scrolling stay smooth (compare with the startup numbers in AGENTS.md, "Open items and reference numbers").
- Light and dark themes both read correctly.
- Install a newer APK over an older one: data survives.
- The launcher, the Recents card and the start screen show the Graphene logo, not Tauri's.

## Open items

1. Single default vault on Android at first, or the multi-vault switcher too? Decided 2026-11-27: several private vaults ("Vaults on a phone").
2. Do we want an SAF export or mirror folder before sync exists, or is a "share a .zip" export enough for testers?
3. Which share-target approach (community plugin or a small Kotlin intent filter)?
4. When to add the signed-APK CI job (needs an Android SDK and NDK runner setup).
5. Whether the sideload developer-verification rules affect the tester group (check before widening it).
6. Phone navigation: built (see "Phone navigation"). Still open: a "+" on the Tasks list screen, whether the list needs a `[...]` menu at
   all, a live search field, swipes. The bottom bar hides while a field has the focus.
