# Graphene

A minimal desktop app for writing markdown notes and keeping reusable code snippets as code blocks inside them — built with Tauri v2, React 19, and TypeScript.

![Graphene screenshot](docs/screenshot.png)

## Features

### Notes
- One kind of item: a markdown note. Write in plain text; **Ctrl+E** flips between editing and the rendered view
- Markdown formatting toolbar (headings, bold, italic, strikethrough, lists, quote, inline code, code block, link, divider) drawn as icons. Hover one for its shortcut and the markdown it writes; the buttons for the formats at your cursor light up. Also **Ctrl+B** / **Ctrl+I** and Tab to indent. It works on highlighted text: code block wraps the selection, lists prefix every line, and pressing a lit format again takes it off
- **Ctrl+Z** undoes and **Ctrl+Shift+Z** (or **Ctrl+Y**) redoes, formatting included
- Copy a whole note with the copy icon in the item header (the markdown, without the title)
- **Images**: paste a picture (a screenshot, an image copied from a page) into the editor, or drop image files (png, jpg, gif, webp, svg) onto the open editor. Each is copied into an `attachments` folder in your vault and linked in the note as `![](../attachments/xyz.png)`, a path other markdown editors understand too. They show in the reading view. Moving a note to a folder of another depth rewrites its image links. The name `attachments` is kept for that folder, so a vault-root folder can't use it, and it does not show in the sidebar. Emptying the trash deletes the pictures that no note mentions any more (see Trash)
- A word count sits under every note
- Organize notes in nested folders

### Task lists and to-dos
- Write tasks as `- [ ] item`, or use the task button in the toolbar. In the reading view, click a checkbox to tick it; the note is saved
- **Enter** on a task line in the editor starts the next task; Enter on an empty task clears it
- A note whose first line (after blank lines and headings) is a task is a **to-do**: it has its own icon and sidebar filter, shows how many tasks are done (`2/5`), and you can hide the finished ones with the eye button in its header
- **+ to-do** (or **Ctrl+Alt+N**) starts a to-do with the first task ready
- Reorder the tasks of a to-do by dragging the handle that shows at the left of a task when you hover it; drop anywhere over the note, a line shows where it lands, and tasks indented under another move with it
- Add a due date by writing `due:2026-12-01` in a task. It shows as a chip: red when overdue, blue on the day

### Code
- **+ code** (or **Ctrl+Shift+N**) starts a note with an empty fenced block and the cursor inside it; the word after the opening fence is the language
- While the cursor is inside a code block, a language chip appears at the right of the editor toolbar (or press **Ctrl+L**): pick a language, or type any name and press Enter. It rewrites the block's opening fence for you
- Fenced code is syntax highlighted (JS, TS, CSS, SCSS, HTML, shell, JSON, Python, SQL and more) and has a copy icon
- **Ctrl+C** with nothing selected copies the code when the open note has exactly one code block
- A note that starts with a code block counts as code in the sidebar (icon and filter)

### Organization
- Hierarchical folders — nest as deep as needed
- Drag-and-drop items between folders, or onto Trash to delete them; drag a note or a folder between its neighbours to put it where you want
- Search palette (**Ctrl+K**): your recent items while the box is empty, live matches while you type, **Enter** opens the highlighted one. Title letters that match are highlighted (a title also matches when your letters appear in order, so `gitch` finds "Git cheatsheet"), and text matches show the sentence they were found in
- Search narrows with `in:folder`, `type:todo` (or `note`, `code`), `title:word`, `"an exact phrase"` and `-word` to leave notes out (`-type:code` works too). Several words must all match
- **Ctrl+F** finds in the open note, in the reading view and in the editor: **Enter** and **Shift+Enter** step through the matches, Escape closes the box
- Right-click works everywhere in the app. In the sidebar, items: open, edit, rename, duplicate, copy note or code, move to a folder, reveal in Explorer, move to trash; folders: new note or code here, new subfolder, rename, reveal, delete; empty space: new note, code or folder. **Shift+F10** (or the menu key) opens the menu of the selected item
- Text fields (the editor, titles, search) get undo, redo, cut, copy, paste and select all, and the editor adds a Format submenu. The read view offers copy, links and code blocks, and the header, trash and empty space have menus too
- Filter by type (all / notes / to-dos / code)
- Order by hand, by name or by recent; the order choice and collapsed folders are remembered. A hand-made order is saved in each note's frontmatter (`order:`) and, for folders, in a hidden `.folder-order.json` in the vault
- Rename (click the title or **F2**) and move (folder chip) straight from the item header
- Drop an item on empty sidebar space to move it out of its folder

### Trash
- Deleting an item moves it to the trash instead of erasing it; open the trash from the button at the bottom of the sidebar
- Restore an item to its folder (or the vault root if that folder is gone), or empty the trash after a confirmation. Emptying also deletes, for good, the pictures in `attachments` that no note (live or in the trash) mentions any more. Only pictures Graphene saved itself are touched (named with 10 random characters); images you put there by hand stay, and if a folder can't be read nothing is deleted
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
| Ctrl+Alt+N | New to-do (a note that starts with a task) |
| Enter | In the editor, on a task line: start the next task |
| Ctrl+K | Open the search palette |
| Ctrl+F | Find in the open note (Enter next, Shift+Enter previous). With no note open it opens the search palette |
| Up / Down | Move through the sidebar list; in the search palette, through the results |
| Enter | In the search palette: open the highlighted result |
| Shift+F10 | Open the context menu of the selected item |
| Ctrl+Z | Undo in the editor |
| Ctrl+Shift+Z / Ctrl+Y | Redo in the editor |
| Ctrl+E | Edit selected item / go back to reading |
| Ctrl+L | In the editor, inside a code block: set the block's language |
| F2 | Rename the open item (in the sidebar, the selected one) |
| Ctrl+C | Copy the code of the open note (when no text is selected and it has one code block) |
| Ctrl+S | Save now (autosave also runs while you type) |
| Ctrl+Enter | In the editor: save and go back to reading |
| Escape | Close editor and return to the item |
| Del | Move the item to the trash (an Undo bar shows for a few seconds), or delete the selected folder (asks first) |

### Window and theme
- **Light and dark theme**: the button at the top of the sidebar cycles System (follows Windows), Light and Dark; the choice is remembered
- **Sidebar**: the button in the top-left corner hides and shows it, and a wide window remembers the choice. In a window narrower than 800px it starts hidden and opens over the note, closing when you pick a note, press Esc or click outside it
- Graphene remembers the size, position and maximized state of its window. Opening it a second time brings the open window forward instead of starting another

### Updates
- Graphene looks for a new version a few seconds after launch (Windows only). An **Update** pill appears next to the version at the top of the sidebar; it opens the changes of every version you have not installed yet, newest first, with an **Install and restart** button
- Click the version number to check again

### Storage
- File-based vault at a user-chosen directory
- Every item is a `.md` file with YAML frontmatter
- Folders are real OS directories
- Edit a note in another editor (or let Dropbox, Syncthing or git change it) and Graphene picks the change up when you switch back to its window. A note you are typing in keeps your text; notes saved with Windows line endings load fine
- Deleted items live in a hidden `.trash` folder inside the vault (dot folders are ignored by the app)
- Only `.md` files with an id in their frontmatter are notes; anything else in the vault is left alone. Snippet files from version 0.1.0 (`.js`, `.css`, etc. with a metadata comment) are no longer converted
- Vault location stored at `%APPDATA%\com.graphene.app\graphene\config.json`
- No cloud, no accounts — everything stays on your machine

### Use your notes from AI agents (MCP)
A small [MCP](https://modelcontextprotocol.io) server lets assistants such as Claude search, read and add to your notes. It reads the vault folder directly, so it works whether or not Graphene is open, and it follows the same rules as the app (note kinds, the search language, tasks and `due:` dates).

**To connect an assistant**, click the plug button at the bottom of the sidebar. The dialog has the steps for each one. What an assistant may do with your notes (read only, ask before writing, and so on) is set in that assistant's own permissions.

- **Claude app:** "Add to Claude" opens the bundled extension (`graphene.mcpb`) in the app's own install screen. It needs no Node.js. The Claude app keeps its own copy and does not update it, so after a Graphene update the dialog reminds you to add it again. The same file is attached to every [release](https://github.com/MogensenJesse/graphene/releases/latest) for people who do not have Graphene installed
- **Claude Code, Cursor, ChatGPT desktop and Codex, VS Code (Copilot), Gemini CLI, others:** the dialog shows the command or the JSON for each, with the real path to the server. They run it with Node.js 18 or newer
- ChatGPT and Claude in a web browser cannot reach a program on your computer, so they cannot connect

To set it up from the source instead, build it and register it with your client (here Claude Code, with the path to the file you built):

```bash
npm run build:mcp
claude mcp add --scope user graphene -- node <path to dist-mcp/graphene-mcp.mjs>
```

`npm run pack:mcpb` builds the Claude extension, `dist-mcp/graphene.mcpb`. `npm run tauri dev` and `npm run tauri build` run both steps themselves, and the installer ships both files.

| Tool | What it does |
|---|---|
| `list_folders` | The folders, with how many notes each holds |
| `search_notes` | Find notes with the app's search language (`in:`, `type:`, `title:`, "phrases", `-word`); an empty query lists the newest |
| `read_note` | The whole text of a note |
| `list_tasks` | Tasks across all notes, soonest due first; filter by `due_by`, `folder`, `include_done` |
| `create_note` | A new note, optionally in a folder (created if missing) |
| `append_to_note` | Add text to the end of a note; append `- [ ] text due:2026-12-01` to add a task |
| `edit_note` | Change text inside a note: replace `old_text` with `new_text` (it must match exactly and appear once, unless `replace_all` is set); an empty `new_text` deletes the text |
| `set_task_done` | Tick or untick a task by its line number from `list_tasks` |

- It never deletes, renames or moves a note. The four tools that only read are marked as read-only, which an assistant can use in its permission prompts (`create_note`, `append_to_note`, `edit_note` and `set_task_done` are the ones that write)
- It uses the vault Graphene has chosen; `--vault <folder>` (or the `GRAPHENE_VAULT` variable) points it at another one, for example a copy to try it on
- If a note is open in Graphene with typing that is not saved yet, Graphene's next autosave wins over what the agent wrote there. A note you are only reading updates when you switch back to the window
- The text of your notes is handed to the agent: only connect agents you trust with your notes

## Stack

- [Tauri v2](https://tauri.app) — desktop shell (transparent acrylic window, no decorations)
- React 19 + TypeScript — UI
- Vite — build tooling
- SCSS + CSS custom properties — styling
- [Lucide](https://lucide.dev) icons (ISC license), copied as inline SVG in `src/components/ui/Icon.tsx`, so no icon package is bundled
- [Biome](https://biomejs.dev) — linting and formatting
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — the notes server for AI assistants (`mcp/`)

## Development

```bash
npm install
npm run tauri dev
npm test
```

`npm run tauri dev` first builds the MCP server and the Claude extension (about a second), because the app ships them.

## Build

```bash
npm run tauri build
```

The build also packs the MCP server and the Claude extension into the installer. Builds sign the updater files, so set `TAURI_SIGNING_PRIVATE_KEY` (the path to the key file, or its contents) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` first; without them the build fails at the end. `npm run tauri dev` needs neither.

## Releases

A GitHub Action builds the Windows installer when a version tag is pushed, adds `graphene.mcpb` (the Claude extension) to the draft release, and installed copies update themselves from it.

1. While you work, add short lines under `## Unreleased` at the top of `CHANGELOG.md`, grouped as `### New`, `### Changed`, `### Fixes` and `### Other`. Plain language, one line per change. The same text becomes the GitHub release notes and the changelog inside the app.
2. `npm version patch` (or `minor` / `major` / an exact number like `0.3.0`). It checks the changelog, bumps `package.json` and `src-tauri`, turns `## Unreleased` into `## vX.Y.Z`, commits "Release vX.Y.Z" and tags it. The working tree must be clean.
3. `git push --follow-tags`
4. Review the draft release on GitHub and publish it. Installed apps only see published releases.

One-time setup: generate a signing key with `npx tauri signer generate -w %USERPROFILE%\.tauri\graphene.key`, put the public key in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`), and add the repository secrets `TAURI_SIGNING_PRIVATE_KEY` (the contents of the key file) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Keep the private key safe: without it, installed copies can no longer update. Copies that predate the updater (before v0.2.0) have to be reinstalled by hand once.
