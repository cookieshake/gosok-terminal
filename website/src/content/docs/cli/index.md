---
title: CLI Reference
description: gosok command-line interface reference
---

The `gosok` binary serves as both the server and the CLI client. When run without arguments, it starts the server. With a subcommand, it calls the running server's API.

## Usage

```
gosok [command] [subcommand] [args] [flags]
```

## Commands

### Server

| Command | Description |
|---------|-------------|
| _(no args)_ | Start the gosok server |

### Project

| Command | Description |
|---------|-------------|
| `project list` | List all projects (alias: `ps`) |
| `project create <name> --path <dir>` | Create a project |
| `project update <id> [--name N] [--path P]` | Update a project |
| `project delete <id>` | Delete a project |

### Tab

| Command | Description |
|---------|-------------|
| `tab list [project]` | List tabs, optionally filter by project (alias: `ls`) |
| `tab create <project-id> [--name N] [--type shell]` | Create a tab |
| `tab update <id> --name <name>` | Update a tab |
| `tab delete <id>` | Delete a tab |
| `tab start <id>` | Start a tab |
| `tab stop <id>` | Stop a tab |
| `tab screen <id> [--lines N] [--bytes N]` | Read terminal output (default: 24 lines) |
| `tab write <id> <text>` | Write text to terminal input (appends newline) |

### Msg

| Command | Description |
|---------|-------------|
| `msg send <tab-id> <message>` | Send a direct message |
| `msg send --all <message>` | Broadcast to all tabs |
| `msg inbox [tab-id]` | Read inbox (defaults to `$GOSOK_TAB_ID`) |
| `msg read [tab-id]` | Mark inbox as read |
| `msg wait [--timeout 30s] [tab-id]` | Wait for next message |
| `msg feed [message]` | Post to feed (with arg) or read feed (without) |

### Notify

| Command | Description |
|---------|-------------|
| `notify <title> [--body <text>] [--flag]` | Send a notification |

### Setting

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
