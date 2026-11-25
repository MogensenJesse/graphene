# Changelog

## Unreleased

### New
- Press Escape while dragging a note, folder, task, list or group to cancel the drag. Nothing moves
- Right-click a task for a menu of its own: open details, rename, mark done, mark important, add to My Day, set the due date (today, tomorrow or a date you pick), move to a list, copy the title or delete it
- Deleting a folder, a to-do list or a group now shows an Undo bar (or press Ctrl+Z). A folder comes back with its subfolders and every note where it was, a list with all its tasks, ticked ones too
- Right-click a folder and choose Move to to put it under another folder or at the top level; the pictures in its notes keep working. A note's or folder's menu also has Copy path
- Right-click menus show the keyboard shortcut of an entry where there is one (Ctrl+K, F2, Del, Ctrl+E and so on), and notes, folders, tasks, lists and groups have Move up and Move down in theirs, so they can be put in order without dragging
- Ctrl+Z undoes a "moved to trash" or "deleted" message when you are not typing in a text box (a new note you have not typed in yet counts), and the message stays while you point at it
- Arrow keys walk through the folders and notes in the sidebar: Right opens a folder, Left closes it (or goes to the folder a note sits in), Home and End jump to the first and last
- A folder's + button offers a new note, new code or subfolder. A to-do list's heading has a … menu, and a note in the sidebar shows a … when you point at it, with the same menu as a right-click
- With the sidebar hidden, Search, New and Settings stay next to its toggle button
- Each note in the Trash has Delete forever (it asks first), restoring a note says where it went and why when its folder was gone, and Escape leaves the Trash and goes back to the note you had open. The Trash now says notes, not items
- If another program (an AI assistant, a sync tool) changes the note you are typing in, Graphene asks "Keep mine" or "Load theirs" instead of quietly saving over it. If you leave the note with the question open, what you typed is kept as a copy called "(conflict copy)"

### Changed
- The window now says what a drop does while you drag files over it; files Graphene cannot import are named in a message, and dropping files in the Tasks tab no longer imports notes and jumps to the Notes tab
- The same thing is called the same everywhere: New folder and New subfolder (not Add), Show in Explorer (not Reveal in Explorer or Show file), Mark as not important, and menu entries that open a dialog end in …
- In the Notes tab, Search is the first item in the sidebar, as in the Tasks tab, and the All / Notes / Code filter is gone (search still understands `type:`)
- The text in the interface is a little bigger
- The right-click menu on an empty spot of the window now fits the tab you are in: "New task" in Tasks, the new note and code entries in Notes
- Things ease in and out instead of snapping: menus and dialogs, dropdowns, folder and list arrows, the Undo bar, a task you add, and a task you tick or delete, which folds away
- A task's details (title, steps, My Day, due date, list and note) now open in a side pane next to the list, which slides in and out, instead of under the task. Escape or the close button closes it
- Folder names are checked as you type them (no slashes, no dot at the start, no Windows reserved names, no duplicates), and the delete messages for folders and to-do lists say exactly what is moved or removed
- Text now uses the Regular and SemiBold weights where they were meant, so body text is a little lighter and selected items stand out
- Scrollbars are thin, faint and always visible, grow smoothly when you point at them, are easy to grab, and the text no longer shifts when one appears. Keyboard focus now shows on the update pill, the due-date chip, the folder-delete buttons and the dropdown lists, and the dim behind the floating sidebar follows the theme
- Buttons, checkboxes and the "are you sure" bars look and behave the same everywhere (every button, the window buttons and the formatting bar included, sinks a little when pressed and shows the same focus ring), the dropdown rows match the right-click menu, all dialogs share one width, and the AI assistant picker in Settings is a row of buttons like the theme picker
- Escape in a task's details first drops what you were typing in a field, and a second Escape closes the pane. "Open details" in a task's right-click menu puts the cursor in its title
- The window now appears once Graphene is ready to use, instead of first showing an empty see-through rectangle, and a maximised window no longer flashes at its normal size when it opens
- Graphene starts a little faster: it reads its list of vaults in one step, and Settings, Search, the update window and the note view's formatting are loaded only when they are needed
- Big vaults open much sooner: the list of notes appears as soon as it is read and the text of the notes fills in behind it. Searching by title works at once; Ctrl+K says "Indexing…" until every note's text is in, and text matches appear as they load
- Coming back to the window only reads the notes that changed on disk, so it is quick in a big vault, and the trash is read when you open it instead of at start (the number by the trash icon is still there)
- Typing in a very large note stays smooth: the word count under it catches up a moment after you stop typing instead of on every key. Ctrl+K and Find in a note are quicker in a big vault or a large note
- With a big vault, the sidebar no longer redraws every note when one note changes in the background, when you pick a note, or while you drag, so dragging a note, folder, task or list is smoother, and ticking a task redraws only that task
- Coming back to the window re-reads the to-do lists at most every few seconds instead of every time, and saving a change to a list now takes three file operations instead of five, so tasks stay quick on a slow disk
- Pictures in a note load only when they are near the view and are kept for next time, and a picture you paste or drop is scaled down to at most 2000 pixels wide or tall (GIF and SVG are left as they are), so notes with many pictures open lighter
- The menu key on a highlighted folder opens that folder's menu

### Fixes
- Switching between Notes and Tasks keeps the sidebar scrolled where it was, and a note opened from Search inside a closed folder opens the folders around it and scrolls into view
- The dropdown lists (a note's folder, a code block's language, a task's list) now light up the row you point at, in both themes
- When a note, task or folder cannot be saved you now get a message with a Retry button, and the unsaved dot stays until it is saved
- While a vault is being read the sidebar says "Loading…" instead of "Nothing here yet"
- If the vault you had open cannot be found when Graphene starts, it opens another one and tells you which one it could not open
- A vault whose folder was renamed, deleted or unplugged is no longer quietly created again as an empty folder when something is saved: you get a message that says the vault folder is not there instead, and while a vault cannot be opened the sidebar's New note, New code, New folder and to-do lists are switched off
- Saving a note can no longer lose it if the disk write fails: the old file stays until the new one is safely written. Notes written by an AI assistant are saved the same way
- Text typed in a task field is no longer lost when you switch tabs or close the window
- If a note cannot be saved when you close the window, the window stays open once so you can retry, and a note that could not be saved is no longer overwritten when you come back to the window
- A failed move to the trash no longer shows an Undo message, and deleting a group of to-do lists now asks first
- Holding the Del key can no longer delete a folder, and Del on a note works again after you click a folder
- After an error the window shows a panel with a Reload button instead of going blank
- Dialogs (Search, Settings, the update) now take the keyboard: the focus starts inside, Tab stays in the dialog, the window behind ignores keys and clicks until it closes, and the focus goes back to where you were
- F2 renames the highlighted folder, and no longer renames the open note as well when a folder is highlighted
- Screen readers now hear which task a checkbox or star belongs to, the item a checkbox in a note belongs to, and which menu choice is checked
- A long stretch of typing with no pause is now saved every few seconds, instead of only once you stop
- Delete forever on a note in the Trash also removes the pictures only that note used, and the Trash opens faster in a big vault (a note's text is read when you restore it)
- A change made to the open note by another program is noticed within a few seconds, not only when you come back to the window
- If the vault's folder is renamed, deleted or unplugged while Graphene is open, it says so: a message replaces the notes, or, if you have unsaved text, a bar above the note keeps that text and retries every few seconds until the folder is back. It no longer says "0 notes" for a vault it cannot open
- Closing the window waits for a task that is still being saved, and warns once if it could not be. An update no longer installs while a note or task is unsaved, and switching, adding or removing a vault waits for the last save and is held back once if it failed

### Other
- The assistant connection (MCP) no longer creates a vault folder that is missing

## v1.6.0

### New
- Several vaults. Add as many as you like and switch between them from the vault name at the top of the sidebar. Rename, reorder and remove them in Settings; removing one only takes it off the list, its folder stays
- Settings, from the gear at the bottom of the sidebar or Ctrl+,. It has the theme, a note font, a code font and a text size for notes and code, plus your vaults and the AI assistant setup
- AI assistants can use all your vaults. Each vault has a "Share with AI assistants" switch, and the assistant picks a vault by name
- Tasks, a to-do app of its own next to your notes. Switch with Notes | Tasks at the top of the sidebar (Ctrl+Shift+T). Lists with colours and groups, My Day and Important, due dates, steps and a note on each task, and a Completed section. Drag tasks and lists to reorder them, and tasks onto a list to move them
- Ctrl+K finds tasks as well as notes, marked with a Task tag. `type:task` shows only tasks
- AI assistants can use your tasks: look at them, add them, change them and tick them off, but never delete or rename them

### Changed
- The to-do note type is gone. A note that starts with a task is an ordinary note now, and its checkboxes still work in the reading view. Ctrl+Alt+N is gone, the filter is All / Notes / Code, and `type:todo` in search finds nothing (use `type:task` for tasks)
- The assistant tool `list_tasks` now lists the tasks of the Tasks tab instead of the checkboxes in notes, and `set_task_done` is replaced by `complete_task`. To change a checkbox in a note, an assistant uses `edit_note`
- The theme button and the plug button are now in Settings
- The version number and "Check for updates" moved to Settings, in a new About tab. The sidebar header shows the Update pill only when an update is waiting
- Trash is now a small button with its count at the bottom of the sidebar. While you drag a note, it grows into a wide "Drop to move to Trash" target
- The list heading in the sidebar now counts what the filter shows ("12 notes", "3 code notes") instead of saying "Folders"

### Fixes
- A vault on another drive no longer stops working after Graphene restarts
- A vault whose folder is missing, such as a drive that is not connected, says so instead of showing an empty list

## v1.5.0

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
