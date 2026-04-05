---
title: Quick Start
description: Get up and running in 2 minutes
---

## Start the Server

After [installing gosok](/gosok-terminal/getting-started/installation/), start the server:

```bash
./gosok
```

Open `http://localhost:18435` in your browser.

## Create Your First Project

1. Click **+ New Project** in the sidebar
2. Enter a name and path (e.g., your project directory)
3. Click **+ Shell** in the tab bar to open a terminal

You now have a working terminal session in the browser.

![Terminal mode](../../../assets/screenshots/terminal.png)

## Open Multiple Tabs

Click **+ Shell** again to create additional tabs. Each tab runs its own shell session. Tabs persist when you switch between them -- the processes keep running in the background.

## Try the Editor

Click **Editor** in the mode switcher (top-right area) to open the built-in file editor. It supports syntax highlighting and `Cmd+S` / `Ctrl+S` to save.

![Editor mode](../../../assets/screenshots/editor.png)

## Using the CLI

Each tab's shell has `GOSOK_TAB_ID` and `GOSOK_API_URL` set automatically, so you can use the CLI from within any tab:

```bash
# Send a message to another tab
gosok msg send <tab-id> "hello"

# Read your inbox
gosok msg inbox

# Send a browser notification
gosok notify "Build done" --body "All tests passed" --flag
```

See the [CLI Reference](/gosok-terminal/cli/) for the full command list.

## Development Mode

If you're contributing to gosok itself:

```bash
flox activate   # set up Go + Node.js
make dev         # backend + frontend with hot reload
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+S` / `Ctrl+S` | Save file (in editor mode) |
| Swipe left/right | Switch tabs (mobile) |
| Long-press tab | Reorder tabs (mobile) |
