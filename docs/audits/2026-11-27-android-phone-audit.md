# Android app: audit on a real phone (2026-11-27)

A second audit of the Android app, this time on a real phone, prompted by "some menus are partly off screen, like choosing a color in task view".
The first audit (`2026-11-26-android-ui-ux-audit.md`) was on an emulator; its Rounds 1 to 9 fixed what it found. P1 to P6 below were fixed
afterwards: see "Round 10 status" at the end.

## Device and method

- OnePlus CPH2493, Android 16, 1240 x 2772 px at 560 dpi: **354 x 792 css px** (the emulator was 411 x 914), light theme, three-button navigation bar
  (44 px, which the page sees as `env(safe-area-inset-bottom)`; the status bar is 40 px). A debug APK, over USB.
- The test data was the emulator audit's seed vault (46 notes in folders, 8 task lists in 2 groups), copied into a second vault made in the app
  (Settings, Vaults, New vault) so the user's own vault stayed untouched. It was deleted at the end; the phone has only its own `Notes` vault again.
- Driven with `adb input` (taps, long-presses) and read through Chrome DevTools: a probe measured every open popup (`.context-menu`, `.select-pop`,
  `.calendar-pop`, `.toast`, `.modal__panel`) against the window, the status bar and the navigation bar, and a second pass listed the touch
  targets under 44 px.
- Screens and popups covered: the notes and tasks lists, a task list, task details, a note (read and edit), the Trash, Settings, the search
  palette, the new-list input, the undo toast, and every kind of menu and picker: list, folder, note, task and editor menus with their submenus, the
  header sort and vault menus, the Select (fonts), the calendar (from the add-task box, the details and a task's menu).

## Summary

Five findings, one of them the user's. Three are the same defect in different places: **the popups know about the window, not about what a finger
can reach on this phone**. The first two are in the context menu, the third in the calendar and dropdown.

| # | Finding | Severity |
|---|---|---|
| P1 | A menu's lower rows sit under the navigation bar, so they cannot be tapped (a tap there presses the system Home button) | Major |
| P2 | A submenu opens partly off the left edge: Color, Move to, Move to group, Format | Major |
| P3 | The font dropdown cannot be opened, and the calendar needs two taps with the keyboard up: both close when the window resizes | Major |
| P4 | Many touch targets are 36 to 40 px, under the app's own 44 px | Minor |
| P5 | Text of 10.8 and 11.7 px in the task screens | Minor |
| P6 | The editor's text menu opens on top of the text it is about | Minor |

Severity as in the first audit: **Major** is frequent friction or a task that has no touch route; **Minor** is cosmetic or rare.

## Findings

### P1. Menus run under the navigation bar (Major)

Every context menu is clamped to the window with `window.innerHeight - height - EDGE` (`ContextMenu.tsx:74-75`), and the window includes the 44 px
bar. A menu that is tall, or opened low on the screen, ends at y 786 of 792: its last row is under the bar.

| Menu | Where it ends | Under the bar |
|---|---|---|
| A note's long-press menu (low row) | 363 to 786 | 38 px: "Move to trash" |
| A list's "Options" (Chores row) | 504 to 786 | 38 px: "Delete list" |
| The Color submenu of that list | 469 to 786 | 38 px: "Purple" is cut |

The same menus opened higher fit (the note menu from a row at y 318 ends at 741; a task's menu from the top ends at 697). **The tap on a covered row
reaches the system bar:** pressing "Move to trash" at y 760 pressed Home and sent the app to the background. There is a second route to most of the
actions (the header's More actions menu is opened at the top and fits), which is why this is Major and not a Blocker.

A menu taller than the free height is not scrollable either: `.context-menu` has no `max-height`, so a list with many lists (Move to list) has no way
to show them all on a small phone. Screenshots: `02`, `04`.

### P2. Submenus off the left edge (Major)

A submenu opens to the right of its row and, if that does not fit, **flips to the left of the whole parent menu** (`left: auto; right: calc(100% - 4px)`,
`ContextMenu.tsx:78-81`). The parent is 188 px wide and, from a button at the right edge, starts at x 160, so the flipped submenu starts at **-20**: its
icons, check marks and the first letters of every row are clipped. From a long-press at x 114 it starts at **-66**.

| Submenu | Left edge |
|---|---|
| Color (list menu), Move to group, Move to (folder, note, list) | -20 (measured on all of them) |
| Move to (a note's long-press menu), Format (the editor's text menu) | -66 |

This is the case the user noticed: choosing a color in the task view (screenshot `01`). The vertical clamp has the same blind spot as P1: Color is 317 px
tall and ends under the bar.

### P3. Popups that close when the window resizes (Major)

The calendar (`DatePick.tsx:77`) and the dropdown (`Select.tsx:145`) close on every `resize`. On a phone the soft keyboard resizes the window.

- **The font dropdown cannot be opened.** Settings, Appearance, Note font (or Code font), Custom, then "Choose a font…": the list is drawn and removed
  124 ms later (watched with a MutationObserver). Its search field takes the focus, the keyboard comes up, the window resizes, the list closes.
  A programmatic click does the same, so it is not the touch. Custom fonts are unusable on the phone.
- **The calendar takes two taps with the keyboard up.** In "Add a task" with the keyboard showing, the first tap on the calendar button moves the
  focus to the button, the keyboard goes down, the resize closes the calendar that was just opening. The second tap opens it. (Without the keyboard it
  opens at the first tap and fits: 250 x 318 at 96,149 from the add box; 296 x 318 at 26,272 in the details.)

### P4. Touch targets under 44 px (Minor)

`_Touch.scss` aims at 44 px, and `.icon-btn` is 40. Measured on the phone (css px, width x height):

| Screen | Targets |
|---|---|
| Header of the list | vault chip 55x36, Trash 52x40, Settings 40x40, sort "Manual" 70x36 |
| Folder rows | "New in…" 40x40, "Folder options" 40x40, "New folder" 40x40, a row's "Options" 40x40 |
| A note | Copy 36x36, More actions 36x36, the title button 55x21; the editor toolbar buttons 40x40 |
| A task list | More actions 36x36, the date button 40x40, star and check 40x40 |
| Task details | Add to My Day 284x36, Due date 234x36, List 284x36, Delete task 90x36, "Add a step" 26 high, the title field 27 high |
| Trash | Restore 55x36, Delete forever 85x36 (21 px apart), Empty trash 36x36 |

### P5. Small text (Minor)

Under 12 px on the task screens: 10.8 px for "3 open", the due-date and step facts of a row (`task-row__fact`); 11.7 px for the details' option rows,
"Delete task" and the segmented buttons.

### P6. The editor's text menu covers the text (Minor)

A long-press in the editor opens the app's own menu (Undo, Redo, Cut, Copy, Paste, Select all, Format) at the finger: 188 x 344 px of the 464 px left above
the keyboard, on top of the word that was pressed and the toolbar (screenshot `03`). The native menu sits above or below the selection. Its Format
submenu is the -66 case of P2.

## Checked and fine

- Menus opened near the top fit: the vault chip, the sort menu, a folder's options (379 px tall, 249 to 628), a note's More actions, a list's More actions.
- The search palette with the keyboard up (65 to 399 of 464), the new-list input above the keyboard, the formatting toolbar above the keyboard
  (396 to 446), the undo toast (34,609 to 320,658, above the tabs).
- No sideways overflow on any screen at 354 px (`scrollWidth` 354). Key hints (F2, Del, Ctrl+K…) are not drawn on touch.
- Settings: Round 9's design on a 354 px phone, with the two narrow-phone fixes made earlier today (not committed yet).
- The "List" dropdown in the task details is a menu inside the page and fits (screenshot `05`).

## Not checked

Landscape and the dark theme (both need a change to the phone's own settings or a theme change I did not make on someone's phone), a larger system font,
TalkBack, split-screen, other phones or Android versions, a gesture-navigation phone (the emulator is one: its bar is 24 px, so P1 is smaller there),
and the user's own notes and tasks.

## Fix order

1. **One placement helper for popups** (P1, P2, P3): the visible area (the window less the status and navigation bars, less the keyboard), and
   functions that put a box in it: at a point, beside a row, below an anchor. Pure, with unit tests.
2. **The context menu uses it** (P1, P2, P6): menus and submenus are placed inside the visible area, a submenu takes the side with room or overlaps its
   parent, a menu taller than the area scrolls, and the editor's text menu goes above or below the selection.
3. **The calendar and the dropdown stop closing on resize** (P3): they re-place themselves, and the dropdown's search field is not focused on a touch
   screen.
4. **Touch sizes and text sizes** (P4, P5): in `_Touch.scss` only.

Screenshots are in `android-phone-2026-11-27/`: `01` the Color submenu cut off at the left, `02` a note's menu under the navigation bar, `03` the editor's
text menu over the text, `04` Move to group, `05` the details' List dropdown (fine).

## Round 10 status: popups and touch sizes (2026-11-27)

Built as a debug APK, installed over USB and checked on the same phone, with a second vault made from the same seed (deleted afterwards: the phone
has only its own `Notes` vault again). The probe is the one of the audit: it measures every open popup against the window, the status bar and the
navigation bar. **Pass is no `OFF`, `underNav` or `underStatus` for a popup.** The full-screen Settings panel is listed by it too and is meant to
reach under the bars (it pads itself), so that line is not a failure.

| # | What was done | Measured on the phone |
|---|---|---|
| P1 | Menus are placed by `placeAtPoint` inside `visibleBounds` (the window less the status bar, the navigation bar and the keyboard); a menu taller than the room scrolls (`max-height`, `overflow-y: auto`) | A note's long-press menu from the same low row: 319 to 742 (was 363 to 786). "Move to trash" tapped at y 715: the app stayed in front and the toast came (it went Home before). A list's Options 460 to 742; a task's menu 222 to 742; a folder's 255 to 634 |
| P2 | A submenu is `position: fixed` and placed by `placeBeside`: right of its row, else left, else over its parent | Color **6 to 194, 425 to 742** (was -20, 469 to 786, the user's report); Move to group 6, 601 to 742; a folder's Move to 6; a note's Move to 6 (was -66); a task's Move to list 6, 422 to 742; the editor's Format 6, 138 to 458 (was -66) |
| P3 | The calendar and the dropdown follow `resize` (`useAnchorRect`) and place themselves again instead of closing; a searchable `Select` does not take the focus into its search field on a touch screen | The calendar opens at the **first** tap with the keyboard up, 96,150 to 346,481, and stays while the window goes from 464 to 792. The font list is still open 3 s after it opens, and with its search field tapped and the keyboard up (window 464) it sits at 369 to 456 |
| P4 | `--btn-sm` and `--icon-btn-size` are 44px on a touch screen, and so are the rows of a task's details, its title, the note's title button, the Trash button in the header, the box to add a task and the list's name, a task's own button, the "Completed" line, and the dropdown (button, search field, rows) | A scan of every target under 44 px on the notes list, the task list, a task's details, a note and the Trash found none, except the "Add a task" field, which is 43 px high inside its 44 px box (the "Completed" line was changed the same way and not on any of those screens) |
| P5 | `--fs-xs` 12px and `--fs-sm` 13px on a touch screen (11px and 12px on a computer) | Not measured again: see the note below |
| P6 | A text menu opened by a finger (`keepFocus` on a touch screen) goes under the pressed word, or over it, keeping 24 px from it, and scrolls where neither side holds it | At the word "update" with the keyboard up: 150,224 to 338,458 under the word, which stays in view and selected (it was 344 px tall on top of it); Format is reached by scrolling it |

Two things this showed that the first look did not:

- **The phone's font size is 90 %.** The WebView scales `font-size` and a px `line-height` with it, and not a `height`: the "10.8 px" and "11.7 px" of P5
  are 12 px and 13 px at 90 %, and a `line-height: 44px` on the note's title drew 39.6 px. A target is sized with `height` or `min-height`, and its text
  is centred with a padding of `(44px - 1lh) / 2`, not with a line-height (`_Touch.scss`). With this setting the text of `--fs-sm` is now 11.7 px, where
  it was 10.8.
- **A dropdown's own button can be outside the window.** On the font list the first version re-placed itself on the keyboard's resize and still ended
  under the keyboard: the button it hangs from had scrolled to y 664 in a window 464 px tall, so "above the button" was off the screen too.
  `placeBelow` now keeps the box inside the area when its anchor is outside it (a test in `popoverBounds.test.ts`).

**Not checked.** The emulator (gesture navigation, 411 px; adb listed it as unauthorized), a window on a computer (the placing is covered by the unit
tests: a mouse menu starts at the cursor, a submenu flips left of its row, a calendar goes over its button), landscape, a larger system font, TalkBack,
other phones, and the text sizes of P5 with a measurement. A "font list" with fonts in it: Android has no installed-font list in the app, so the
list on this phone is empty ("No font has that name"); it stays open and is placed, but there is nothing to pick yet.

**Known limits.** On a narrow screen a submenu covers the labels of its parent (the highlighted row and its chevron stay visible, and the parent's
right part can still be tapped). A submenu does not follow a parent that is scrolled while it is open. The text menu is placed from the point that was
pressed, not from the selection's own rectangle, and a menu that scrolls has no scroll hint.

**After the first use of the build (a report, not a finding of the audit).** Two more things showed on the phone, both on the list screen. (1) A note's
"…" was only drawn after a pointer had entered its row (`ItemRow` mounts it on the first hover, for big vaults), and a tap is the only "hover" a finger
has: so only the note that had been opened and left had it. Reproduced: two notes, none with a button; open one, Back: that one has it. Every note
is `armed` from the start on a touch screen now. (Task list and folder rows always had theirs: opacity 1 on touch.) (2) The note, list, folder, My Day,
Important or Trash row that was opened last stayed lit (`--selected`, `--active`) after Back, which looked like a stuck hover; a task row did not (the
details slide away and the selection clears). The list is a screen of its own on a phone, so `_PhoneNav.scss` shows no selection on it. A tapped
submenu also focused its first row, which then stayed lit ("No color" in `06`); a touch screen does not do that any more.

Screenshots: `06` the Color submenu, `07` a note's menu and its Move to, `08` the editor's text menu (the keyboard is cropped out), `09` the calendar
after one tap with the keyboard up, `10` the font list over the keyboard (cropped).
