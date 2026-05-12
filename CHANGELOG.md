# Changelog

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
