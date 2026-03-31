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

# 3. Send a command
gosok send $tab "npm test"

# 4. Wait for a response
result=$(gosok wait --timeout 60s $tab)

# 5. Notify when done
gosok notify "Tests Complete" --body "$result" --flag
```

## Messaging System

Tabs can communicate with each other using messages:

### Direct Messages

```bash
# From tab A, send to tab B
gosok send <tab-b-id> "build done"
```

### Broadcast

```bash
# Send to all tabs
gosok send --all "DB migration complete"
```

### Global Feed

```bash
# Post to the feed
gosok feed "v2.1 release ready"

# Read the feed
gosok feed
```

### Inbox & Wait

```bash
# Read inbox
gosok inbox

# Block until a message arrives (or timeout)
gosok wait --timeout 30s
```

The `wait` command exits with code 0 on message received, 1 on timeout — making it easy to use in scripts and agent loops.
