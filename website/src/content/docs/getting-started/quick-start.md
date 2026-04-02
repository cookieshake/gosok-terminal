---
title: Quick Start
description: Get up and running in 2 minutes
---

## Development Mode

For development with hot-reload on both frontend and backend:

```bash
flox activate   # set up Go + Node.js
make dev         # runs backend + frontend concurrently
```

The frontend dev server proxies API requests to the Go backend.

## Create Your First Project

1. Open `http://localhost:18435`
2. Click **+ New Project** in the sidebar
3. Enter a name and path (e.g., your project directory)
4. Click **+ Shell** in the tab bar to open a terminal

<!-- TODO: screenshot of first project screen -->
<!-- ![First project](../../../assets/screenshots/quick-start-first-project.png) -->

## Using the CLI

From any terminal where gosok is running, you can manage projects and tabs:

```bash
# List projects
gosok project list

# Create a project
gosok project create my-app --path /code/my-app

# Create and start a tab
gosok tab create <project-id> --name "dev-server"
gosok tab start <tab-id>

# Send a message to a tab
gosok msg send <tab-id> "npm run dev"
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+S` / `Ctrl+S` | Save file (in editor mode) |
| Swipe left/right | Switch tabs (mobile) |
