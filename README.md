# Graphene

A minimal desktop app for writing markdown notes and keeping reusable code snippets as code blocks inside them — built with Tauri v2, React 19, and TypeScript.

![Graphene screenshot](docs/screenshot.png)

## Features

### Notes
- One kind of item: a markdown note. Write in plain text; **Ctrl+E** flips between editing and the rendered view
- Markdown formatting toolbar (bold, italic, inline code, links, etc.) with tooltips, plus **Ctrl+B** / **Ctrl+I** and Tab to indent
- Organize notes in nested folders

### Code
- **+ code** (or **Ctrl+Shift+N**) starts a note with an empty fenced block and the cursor inside it; the word after the opening fence is the language
- While the cursor is inside a code block, a language chip appears at the right of the editor toolbar (or press **Ctrl+L**): pick a language, or type any name and press Enter. It rewrites the block's opening fence for you
- Fenced code is syntax highlighted (JS, TS, CSS, SCSS, HTML, shell, JSON, Python, SQL and more) and has a copy button
- **Ctrl+C** with nothing selected copies the code when the open note has exactly one code block
- A note that starts with a code block counts as code in the sidebar (icon and filter)

### Organization
- Hierarchical folders — nest as deep as needed
- Drag-and-drop items between folders
- Text search across all notes; matching folders open automatically and the rest hide
- Filter by type (all / notes / code)
- Sort by name or recent; sort order and collapsed folders are remembered
- Rename (click the title or **F2**) and move (folder chip) straight from the item header
- Drop an item on empty sidebar space to move it out of its folder

### Trash
- Deleting an item moves it to the trash instead of erasing it; open the trash from the button at the bottom of the sidebar
- Restore an item to its folder (or the vault root if that folder is gone), or empty the trash after a confirmation
- A deleted folder's loose files (anything that is not a note) go to the trash folder on disk too

### File import
- Drop `.md` files directly onto the window to import them into the selected folder
- Drop `.js`, `.ts`, `.css`, `.scss`, `.html`, or `.sh` files to import them as a note holding one code block

### Editing
- Unsaved-changes indicator (dot next to title in the editor and sidebar)
- Autosave about a second after you stop typing, and before you leave the editor or close the window
- **Ctrl+S** saves immediately; the done button (or Escape) closes the editor

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+N | New note |
| Ctrl+Shift+N | New code (a note that starts with a code block) |
| Ctrl+K / Ctrl+F | Focus search |
| Up / Down | Move through the list (from the search box or the list) |
| Enter | In search: open the first match and leave the box |
| Ctrl+E | Edit selected item / go back to reading |
| Ctrl+L | In the editor, inside a code block: set the block's language |
| F2 | Rename the open item |
| Ctrl+C | Copy the code of the open note (when no text is selected and it has one code block) |
| Ctrl+S | Save now (autosave also runs while you type) |
| Escape | Close editor and return to the item |
| Del | Move the item to the trash, or delete the selected folder (both ask first) |

### Storage
- File-based vault at a user-chosen directory
- Every item is a `.md` file with YAML frontmatter
- Folders are real OS directories
- Deleted items live in a hidden `.trash` folder inside the vault (dot folders are ignored by the app)
- Snippet files from earlier versions (`.js`, `.css`, etc. with a metadata comment) are converted to notes on first launch: the code goes into a fenced block, and the original file moves to `.trash`. Copy counts are not kept
- Vault location stored at `%APPDATA%\graphene\config.json`
- No cloud, no accounts — everything stays on your machine

## Stack

- [Tauri v2](https://tauri.app) — desktop shell (transparent acrylic window, no decorations)
- React 19 + TypeScript — UI
- Vite — build tooling
- SCSS + CSS custom properties — styling
- [Lucide](https://lucide.dev) icons (ISC license), copied as inline SVG in `src/components/Icon.tsx`, so no icon package is bundled
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
