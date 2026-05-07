# FlowVault

A minimal desktop app for storing, tagging, and copying reusable Webflow custom code snippets — built with Tauri v2, React 18, and TypeScript.

![FlowVault screenshot](docs/screenshot.png)

## Features

- Store and organize custom code snippets (JS, CSS, HTML, JSON-LD, and more)
- Tag and filter snippets by language or project
- One-click copy to clipboard
- Persistent local storage — snippets live on your machine, no cloud required
- Acrylic/frosted glass window effect on Windows

## Stack

- [Tauri v2](https://tauri.app) — desktop shell
- React 18 + TypeScript — UI
- Vite — build tooling
- SCSS + CSS custom properties — styling
- Biome — linting and formatting

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Data

Snippets are stored as JSON at:

```
%APPDATA%\com.flowvault.app\flowvault\snippets.json
```
