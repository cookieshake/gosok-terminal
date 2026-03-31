---
title: CLI Overview
description: gosok command-line interface reference
---

The `gosok` binary serves as both the server and the CLI client. When run without arguments, it starts the server. With a subcommand, it calls the running server's API.

## Usage

```
gosok [command] [args] [flags]
```

## Commands

### Server

| Command | Description |
|---------|-------------|
| _(no args)_ | Start the gosok server |

### Projects

| Command | Description |
|---------|-------------|
| `projects` / `ps` | List all projects |
| `project create <name> --path <dir>` | Create a project |
| `project update <id> [--name N] [--path P]` | Update a project |
| `project delete <id>` | Delete a project |

### Tabs

| Command | Description |
|---------|-------------|
| `tabs` / `ls` `[project]` | List tabs (filter by project name/ID) |
| `tab create <project-id> [--name N] [--type shell]` | Create a tab |
| `tab update <id> --name <name>` | Update a tab |
| `tab delete <id>` | Delete a tab |
| `tab start <id>` | Start a tab |
| `tab stop <id>` | Stop a tab |

### Messaging

| Command | Description |
|---------|-------------|
| `send <tab-id> <message>` | Send a direct message |
| `send --all <message>` | Broadcast to all tabs |
| `feed [message]` | Post to feed / read feed |
| `inbox [tab-id]` | Read inbox |
| `inbox read [tab-id]` | Mark inbox as read |
| `wait [--timeout 30s] [tab-id]` | Wait for next message |

### Notifications

| Command | Description |
|---------|-------------|
| `notify <title> [--body <text>] [--flag]` | Send a notification |

### Settings

| Command | Description |
|---------|-------------|
| `setting list` | List all settings |
| `setting get <key>` | Get a setting value |
| `setting set <key> <value>` | Set a setting |
| `setting delete <key>` | Reset to default |

### Other

| Command | Description |
|---------|-------------|
| `help` | Show help |
