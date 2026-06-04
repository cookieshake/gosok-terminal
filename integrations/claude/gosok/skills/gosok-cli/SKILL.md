---
name: gosok-cli
description: Use when controlling gosok-terminal — listing/creating/stopping tabs, sending input or messages to tabs, reading tab screen state, pushing notifications, or interacting with the gosok message bus. Triggers on "gosok 탭", "gosok send", "다른 세션 화면", "screen 봐줘", "/gosok-cli", or any request mentioning the gosok-terminal multiplexer.
---

# gosok-cli

You are driving **gosok-terminal**, a web-based terminal multiplexer, via its `gosok` CLI. The CLI hits a local REST API (default `http://localhost:18435`, overridable via `GOSOK_API_URL`).

## When to use this skill

Use when the user asks you to:

- Create, list, start, stop, or rename gosok tabs
- Send keystrokes/input to a tab (`write`) or messages to a tab's inbox (`send`)
- Read a tab's current screen state (`screen`)
- Push a notification to the user (`notify`)
- Read or post to the global message feed (`feed`)
- Wait for a reply from a specific tab (`wait`)

Do **not** use this skill for:

- Editing gosok's own Go/React codebase — that is regular repo work.
- Browser-side terminal interaction — that is a frontend concern.

## Preflight

Before any `gosok` invocation:

1. Verify the binary is on PATH:
   ```bash
   command -v gosok >/dev/null || { echo "gosok CLI not found on PATH"; exit 1; }
   ```
2. Check the server is reachable (silent — do not noise this to the user unless it fails):
   ```bash
   curl -fsS --max-time 1 "${GOSOK_API_URL:-http://localhost:18435}/api/v1/projects" >/dev/null \
     || echo "gosok server not reachable at ${GOSOK_API_URL:-http://localhost:18435}"
   ```
3. Environment variables you may see and use:
   - `GOSOK_API_URL` — base URL. Default `http://localhost:18435`.
   - `GOSOK_TAB_ID` — set when Claude is running **inside** a gosok PTY tab. `gosok send`, `inbox`, `wait` use it as the default tab.

If the server is down, tell the user "gosok server is not running — start with `make dev` or `bin/gosok`" and stop. Do not retry in a loop.

## CLI reference

| Command | Purpose | Example |
|---------|---------|---------|
| `gosok projects` (alias `ps`) | List all projects (id, path, name) | `gosok projects` |
| `gosok project create <path> [name]` | Register a directory as a project | `gosok project create ~/code/foo Foo` |
| `gosok project update <id> ...` | Rename / re-path a project | `gosok project update 01H... --name Bar` |
| `gosok project delete <id>` | Delete a project (⚠ destructive) | `gosok project delete 01H...` |
| `gosok tabs [project-id]` (alias `ls`) | List tabs (optionally filter by project) | `gosok tabs 01HPROJ...` |
| `gosok tab create <project-id> [title]` | Create a new tab in a project | `gosok tab create 01HPROJ... build` |
| `gosok tab start <tab-id>` | Start (or restart) the PTY for a tab | `gosok tab start 01HTAB...` |
| `gosok tab stop <tab-id>` | Send SIGINT, transition tab to `stopped` | `gosok tab stop 01HTAB...` |
| `gosok tab update <tab-id> --title X` | Rename a tab | `gosok tab update 01HTAB... --title api` |
| `gosok tab delete <tab-id>` | Delete a tab (⚠ destructive) | `gosok tab delete 01HTAB...` |
| `gosok screen <tab-id>` | Print the current screen (cols × rows of cells) | `gosok screen 01HTAB...` |
| `gosok write <tab-id> <bytes>` | Inject bytes into the tab as if typed | `gosok write 01HTAB... 'ls\n'` |
| `gosok send <tab-id> <msg>` | Direct message to a tab's inbox | `gosok send 01HTAB... 'build done'` |
| `gosok send --all <msg>` | Broadcast to all tabs (⚠ ask user first) | `gosok send --all 'restart now'` |
| `gosok inbox [tab-id]` | Read a tab's inbox | `gosok inbox 01HTAB...` |
| `gosok inbox read [tab-id]` | Mark inbox messages as read | `gosok inbox read` |
| `gosok wait [tab-id] --timeout=30s` | Long-poll until a message arrives | `gosok wait 01HTAB... --timeout=2m` |
| `gosok feed` | Print the global message feed | `gosok feed` |
| `gosok feed <msg>` | Post to the global feed | `gosok feed 'CI green'` |
| `gosok notify --body <msg> [--flag] [title...]` | Push a notification to the user | `gosok notify --body 'tests pass' --flag CI` |
| `gosok setting list \| get \| set \| delete` | Manage key/value settings | `gosok setting get theme` |

Notes:
- All IDs are ULIDs.
- `gosok write` treats input as raw bytes; remember explicit `\n` to submit a line.
- `gosok screen` outputs the rendered VT screen, including blank cells — pipe through `grep` if you only want non-empty lines.
- `gosok tab stop` sends SIGINT, not SIGKILL. Long-running processes that ignore SIGINT will keep running until the next stop attempt or process exit.

## Common workflows

### A. Run a command in a fresh tab and observe output

```bash
PROJECT=$(gosok projects | head -1 | awk '{print $1}')
TAB=$(gosok tab create "$PROJECT" 'build' | awk '{print $NF}')
gosok tab start "$TAB"
gosok write "$TAB" 'make build\n'
sleep 3
gosok screen "$TAB" | tail -40
```

Stop polling once the prompt returns (`$ ` at the bottom). If you need to wait longer, sleep+screen in a loop; do not use `wait` here — `wait` is for the **message** inbox, not the PTY.

### B. Send a message to another tab and wait for a reply

```bash
gosok send "$OTHER_TAB" 'are you done with the migration?'
# Block up to 5 minutes for a reply
gosok wait "$GOSOK_TAB_ID" --timeout=5m
```

`wait` exits non-zero with no output when the timeout passes — handle that.

### C. Push a notification when a long task finishes

```bash
make test && gosok notify --body 'tests pass' --flag 'CI' \
          || gosok notify --body 'tests FAIL' --flag 'CI'
```

Use `--flag <title>` to make the notification visible/prominent on the user's device.

### D. List projects and their tabs

```bash
gosok projects
gosok tabs            # all tabs, all projects
gosok tabs "$PROJECT" # tabs in one project
```

### E. Inspect recent activity

```bash
gosok feed | tail -20      # last 20 global messages
gosok inbox "$GOSOK_TAB_ID" # messages directed at this tab
```

## Hard rules

- **Never** run `gosok project delete` or `gosok tab delete` without explicit user confirmation. These are destructive.
- **Never** run `gosok send --all` (broadcast) without an explicit user request. Other tabs may belong to unrelated workflows.
- **Never** assume `GOSOK_TAB_ID` is set. If a command needs a tab ID and the env var is empty, ask the user or `gosok tabs` and pick deliberately.
- `gosok write` is a real keystroke. Do not send `clear`, `exit`, or `Ctrl-C` (write `'\x03'`) without confirming the user wants that effect.
- If the server is unreachable, tell the user once and stop. Do not retry.
