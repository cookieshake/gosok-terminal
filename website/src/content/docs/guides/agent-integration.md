---
title: Agent Integration
description: Using gosok with AI agents and automation
---

## Overview

gosok's CLI is designed for programmatic use by AI agents and scripts. An agent can create projects, spawn tabs, run commands, and receive results — all through the CLI.

## Environment Variables

Each tab's shell automatically receives:

| Variable | Description |
|----------|-------------|
| `GOSOK_TAB_ID` | The current tab's ID |
| `GOSOK_API_URL` | The gosok server URL |

## Agent Workflow Example

```bash
# 1. Create a project
proj=$(gosok project create my-app --path /code/my-app | awk '{print $2}')

# 2. Create and start a tab
tab=$(gosok tab create $proj --name "test-runner" | awk '{print $2}')
gosok tab start $tab

# 3. Send a message to the tab
gosok msg send $tab "npm test"

# 4. Wait for a response
result=$(gosok msg wait --timeout 60s $tab)

# 5. Notify when done
gosok notify "Tests Complete" --body "$result" --flag
```

<!-- TODO: screenshot showing two tabs with message flow -->
<!-- ![Agent workflow](../../../assets/screenshots/agent-workflow.png) -->

## Messaging System

Tabs can communicate with each other using the `msg` subcommand:

### Direct Messages

```bash
# From tab A, send to tab B
gosok msg send <tab-b-id> "build done"
```

### Broadcast

```bash
# Send to all tabs
gosok msg send --all "DB migration complete"
```

### Global Feed

```bash
# Post to the feed
gosok msg feed "v2.1 release ready"

# Read the feed
gosok msg feed
```

### Inbox & Wait

```bash
# Read inbox
gosok msg inbox

# Block until a message arrives (or timeout)
gosok msg wait --timeout 30s
```

The `msg wait` command exits with code 0 on message received, 1 on timeout — making it easy to use in scripts and agent loops.

## Reading Terminal Output

Use `tab screen` to programmatically read what's on a tab's terminal:

```bash
# Read last 24 lines (default)
gosok tab screen <tab-id>

# Read last 50 lines
gosok tab screen <tab-id> --lines 50
```

## Writing to Terminal Input

Use `tab write` to send text to a tab's terminal:

```bash
gosok tab write <tab-id> "npm test"
```

This appends a newline, so the command runs immediately.
