# Changelog

## Unreleased

### New
- Connect an AI assistant such as Claude to your notes. The plug button at the bottom of the sidebar has a one-click setup for the Claude app and copy-and-paste steps for Claude Code, Cursor, ChatGPT, VS Code and Gemini. Assistants can search, read, add to and edit your notes, but never delete, rename or move one
- The Claude app does not update its Graphene add-on by itself, so after you update Graphene, the same dialog reminds you to add it again

## v1.4.0

### New
- Ctrl+Enter in the editor saves the note and goes back to the reading view
- A button in the top-left corner hides and shows the sidebar, and Graphene remembers your choice. In a window narrower than 800px the sidebar starts hidden and opens over the note; it closes when you pick a note, press Esc or click outside it
- Moving a note to Trash takes one click and shows an Undo button for a few seconds. The "…" menu in the title bar has Duplicate, Reveal in Explorer and Move to trash
- Every button shows Graphene's own tooltip with its shortcut, instead of the Windows one
- Under each note: when it was last edited and its word count, or its line count for code

### Changed
- The window can be as narrow as 575px (it was 800px)
- The title bar lines up with the note: the title starts where the text does, the folder picker sits at the left on wide windows and next to Copy on narrow ones, and Edit/Done always stays in the same place
- The progress chip ("3/5 done") is now the button that hides finished tasks, and finished tasks are struck through
- The theme button moved to the top of the sidebar, the All/Notes/To-dos/Code filter sits above the folders, and deleting a folder asks right under that folder
- The Trash list lines up with the note column
- Keyboard focus is easier to see
- Button and menu labels use sentence case, and "No folder" is called that everywhere
- Dates count calendar days, so a note edited late last night no longer says "today" the next morning

### Fixes
- The word count no longer counts Markdown symbols, task boxes or code fences as words
- The formatting toolbar, Ctrl+B and Ctrl+I do nothing inside a code block instead of adding Markdown to the code

### Other
- Starting a development build while the installed Graphene is open no longer just brings the installed window forward

## v1.3.0

### New
- Task lists: tick a task in the reading view and it is saved. A toolbar button writes the list, and Enter on a task starts the next one
- To-do notes: a note that starts with a task gets its own icon and sidebar filter, a done count, and a button to hide finished tasks. Start one with Ctrl+Alt+N, reorder tasks by dragging, and add a due date by writing due:2026-12-01
- Ctrl+F finds text in the open note, in the reading view and in the editor
- Search shows where the words were found, matches titles by letters in order, and understands in:folder, type:todo, "exact phrase" and -word
- A light theme. The button next to Trash switches between System (follows Windows), Light and Dark
- Images: paste a picture into the editor, or drop image files onto it. They are saved in an attachments folder in your vault and show in the reading view
- Emptying the trash also deletes pasted images that no note uses any more
- Notes changed outside Graphene (another editor, Dropbox, git) show up when you switch back to the window
- A word count under every note
- Graphene remembers its window size and position, and opening it a second time brings the first window forward
- Put notes and folders in the order you want by dragging them in the sidebar. The order button now offers Manual, Name and Recent, and dragging in Name or Recent switches to Manual

### Changed
- Ctrl+F no longer opens the search palette while a note is open; Ctrl+K still does
- Switching back to the window no longer re-reads the trash, and large vaults refresh faster. Changes made to the trash outside Graphene show after a restart

### Fixes
- Notes saved with Windows line endings (CRLF) by another editor no longer vanish from the app
- Reordering the tasks of a to-do works anywhere over the note, not only over a task's text, and shows the dragged task and where it lands
- The sidebar's drop zone has rounded corners like the rest of the sidebar

### Other
- Snippet files from version 0.1.0 are no longer converted to notes when a vault opens. They stay where they are
- Internal cleanup: the code is grouped into folders, repeated code was merged, and unit tests were added (`npm test`)
- Removed unused code, styles and settings left over from earlier versions

## v1.2.0

### Changed
- The formatting buttons are now clear icons, with a tooltip that shows the shortcut and the markdown each one writes
- Buttons light up for the format at your cursor (bold, lists, headings and so on)

### Fixes
- Pressing Bold with the cursor inside bold text now removes it instead of adding empty markers

## v1.1.0

### New
- Undo and redo (Ctrl+Z, Ctrl+Shift+Z) keep working after you use the formatting buttons
- Right-click works everywhere in the app, including the editor
- Copy a whole note with one click
- Drag a note onto Trash to delete it

### Changed
- The formatting buttons now work on highlighted text: code block wraps it, pressing bold again removes it, numbered lists count up
- The copy button on code blocks is now an icon

### Fixes
- Deleting the note you are editing no longer stops the next new note from saving
- A dialog no longer closes when you right-click outside it

## v1.0.0

### New
- Notes and code snippets are now one thing: a note. Start one with a code block and it counts as code
- Right-click anything in the sidebar to rename, duplicate, move, reveal in Explorer or delete it
- Press Ctrl+K to search from anywhere
- A trash, so deleted notes can be brought back
- Code is colored and has a copy button and a language picker (Ctrl+L)
- Graphene tells you when an update is out and shows what changed since your version

### Changed
- The title, folder, date and buttons now share one bar, leaving more room for your notes
- New hexagon app icon
- Notes save themselves a moment after you stop typing

### Other
- Snippets from version 0.1.0 turn into notes the first time you open this version. The originals go to the trash folder

## v0.1.0 — Initial release

Graphene is a minimal desktop app for writing markdown notes and storing reusable code snippets. Everything lives in a vault folder on your machine — no cloud, no accounts, no telemetry.

### Notes
- Write in plain text with a live markdown preview toggle
- Markdown formatting toolbar (bold, italic, inline code, links, headings, and more)

### Snippets
- Store code with language labels: JS, TS, CSS, SCSS, HTML, Shell
- One-click copy to clipboard with a running copy counter

### Organization
- Hierarchical folders (nested as deep as you need)
- Drag-and-drop items between folders
- Text search across all notes and snippets
- Filter by type (all / notes / snippets)

### File import
- Drop `.md`, `.js`, `.ts`, `.css`, `.scss`, `.html`, or `.sh` files directly onto the window to import them into your vault

### Keyboard shortcuts
- `Ctrl+N` — new item
- `Ctrl+E` — edit selected item
- `Ctrl+S` — auto-save (keeps the editor open)
- `Escape` — cancel
- `Del` — delete item or folder (with confirmation)

### Storage
Notes are saved as `.md` files with YAML frontmatter. Snippets are saved with their native extension (`.js`, `.css`, etc.). Folders are real OS directories. The vault lives wherever you point it.

---

**Platform:** Windows (acrylic window effect)
