# Changelog

## Unreleased

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
