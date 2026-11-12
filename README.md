# Graphene

A minimal desktop app for writing markdown notes and storing reusable code snippets — built with Tauri v2, React 18, and TypeScript.

![Graphene screenshot](docs/screenshot.png)

## Features

### Notes
- Write in plain text; **Ctrl+E** flips between editing and the rendered view
- Markdown formatting toolbar (bold, italic, inline code, links, etc.) with tooltips, plus **Ctrl+B** / **Ctrl+I** and Tab to indent
- Copy button on fenced code blocks
- Organize notes in nested folders

### Snippets
- Store code snippets with syntax language labels (JS, TS, CSS, SCSS, HTML, Shell)
- One-click copy from the code block, or **Ctrl+C** when no text is selected, with a running copy counter
- Optional prose notes alongside each snippet

### Organization
- Hierarchical folders — nest as deep as needed
- Drag-and-drop items between folders
- Text search across all notes and snippets; matching folders open automatically and the rest hide
- Filter by type (all / notes / snippets)
- Sort by name, recent, or most copied; sort order and collapsed folders are remembered
- Rename (click the title or **F2**) and move (folder chip) straight from the item header
- Drop an item on empty sidebar space to move it out of its folder

### File import
- Drop `.md`, `.js`, `.ts`, `.css`, `.scss`, `.html`, or `.sh` files directly onto the window to import them into the selected folder

### Editing
- Unsaved-changes indicator (dot next to title in the editor and sidebar)
- Autosave about a second after you stop typing, and before you leave the editor or close the window
- **Ctrl+S** saves immediately; the done button (or Escape) closes the editor

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+N | New item |
| Ctrl+K / Ctrl+F | Focus search |
| Up / Down | Move through the list (from the search box or the list) |
| Enter | In search: open the first match and leave the box |
| Ctrl+E | Edit selected item / go back to reading |
| F2 | Rename the open item |
| Ctrl+C | Copy the open snippet (when no text is selected) |
| Ctrl+S | Save now (autosave also runs while you type) |
| Escape | Close editor and return to the item |
| Del | Delete item or folder (with confirmation) |

### Storage
- File-based vault at a user-chosen directory
- Notes saved as `.md` files with YAML frontmatter
- Snippets saved with their native extension (`.js`, `.css`, etc.)
- Folders are real OS directories
- Vault location stored at `%APPDATA%\graphene\config.json`
- No cloud, no accounts — everything stays on your machine

## Stack

- [Tauri v2](https://tauri.app) — desktop shell (transparent acrylic window, no decorations)
- React 18 + TypeScript — UI
- Vite — build tooling
- SCSS + CSS custom properties — styling
- [gray-matter](https://github.com/jonschlinkert/gray-matter) — frontmatter parsing
- [Biome](https://biomejs.dev) — linting and formatting

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```
