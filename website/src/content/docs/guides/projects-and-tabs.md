---
title: Projects & Tabs
description: Organizing your work with projects and tabs
---

## Projects

A project is a named workspace tied to a directory path. Each project has its own set of tabs.

- **Create** — via sidebar or `gosok project create <name> --path <dir>`
- **Edit** — click the pencil icon on hover to rename or change path
- **Delete** — from the edit form or `gosok project delete <id>`
- **Reorder** — drag and drop in the sidebar (long-press on mobile)

The sidebar shows activity dots for each tab in a project:
- Green dot — running and active (recent output)
- Dim green dot — running but idle
- Grey dot — stopped
- Yellow dot — has a flagged notification

## Tabs

Each tab runs an independent shell session via a PTY.

### Lifecycle

| State | Description |
|-------|-------------|
| **Stopped** | Created but no process running |
| **Starting** | PTY being allocated |
| **Running** | Active shell session |

### Actions

- **Start** — allocates a PTY and starts a shell
- **Stop** — sends SIGHUP to the process
- **Close** — stops (if running) and deletes the tab

### Tab Switching

- Click a tab to switch to it
- On mobile, swipe left/right on the terminal area to switch between open tabs
- The last active tab per project is remembered across project switches
