# Android app

Status: plan, nothing built yet. Written 2026-11-21.

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

- A first launch creates a default vault automatically. There is no vault picker, and the multi-vault switcher stays hidden at first.
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
- **Right-click menus become long-press plus visible "..." buttons.** There are about 26 `onContextMenu` sites [C] and no hover
  actions on note rows.
- **Drag and drop:** ship "Move to..." in the menus first. Touch dragging then needs long-press arming and `touch-action` handling in
  `useDragToFolder`, which can wait.
- **Soft keyboard:** the full-height textarea editor must stay above the keyboard, with the formatting toolbar sitting just above
  it. One Tauri Android report found `visualViewport` did not change and `adjustResize` did not help, and needed a Kotlin
  window-insets fix [V, single report], so treat this as the riskiest item. Also check that `execCommand`-based undo works in the
  Android WebView [M].
- **Targets and tooltips:** 44 px minimum touch targets; tooltips do not exist on touch, so labels must not depend on them.
- **Share target** ("Save to Graphene" from other apps): via a community share-target plugin or a small Kotlin intent filter [V].
  Useful, but after the basics.
- **Quick capture and widgets:** native Kotlin writing into an inbox note. Deferred.

## Code changes outside the UI

- Create the vault in app-private storage on first run; skip the vault picker and `allow_vault_folders` on mobile.
- A platform adapter for the few desktop-only calls above (focus and lifecycle, updater, window controls).
- The Rust `scan_vault` command (`src-tauri/src/vault_scan.rs`) works on Android unchanged: it uses plain paths in
  the private vault, so it avoids the SAF slowness entirely.
- The data-safety fixes (write-new-then-delete-old, atomic writes; done in the audit work) matter even more on a phone, where the app
  can be killed at any moment.

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

- **Soft keyboard and the editor** (above). Prototype this first.
- **Tauri on Android is the less mature path.** Budget time for plugin and permission surprises, and keep the platform adapter thin.
- **No background sync.** Changes only sync while the app is open (a deliberate choice for now).
- **App-private storage** means uninstalling the app deletes the notes unless they were exported or synced. Say so in the UI.
- **Sideloading friction** for testers (install-unknown-apps prompts, developer verification from 2026-09-30 in some regions).

## Verification checklist (on a real Android 12 or newer device)

- Fresh install: the default vault is created, a note and a task can be created, edited, moved and trashed with Undo.
- Typing in a long note with the keyboard open: the caret stays visible, the toolbar sits above the keyboard, undo and redo work.
- Kill the app mid-edit and reopen: no lost or duplicated notes (this exercises the data-safety fixes).
- Open the drawer, use long-press menus, use "Move to...", and use Search.
- Rotate, split-screen and switch apps: the layout holds and the state survives.
- A 1,000-note vault: cold start and scrolling stay smooth (compare with the startup numbers in AGENTS.md, "Open items and reference numbers").
- Light and dark themes both read correctly.
- Install a newer APK over an older one: data survives.

## Open items

1. Single default vault on Android at first, or the multi-vault switcher too?
2. Do we want an SAF export or mirror folder before sync exists, or is a "share a .zip" export enough for testers?
3. Which share-target approach (community plugin or a small Kotlin intent filter)?
4. When to add the signed-APK CI job (needs an Android SDK and NDK runner setup).
5. Whether the sideload developer-verification rules affect the tester group (check before widening it).
