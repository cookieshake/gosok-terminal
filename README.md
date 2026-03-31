# gosok-terminal

A web-based terminal multiplexer. Go backend + React frontend, served as a single binary.

![gosok-terminal screenshot](screenshot.png)

## Features

- **Project workspaces** — Organize terminals by project. Switch contexts without losing your place.
- **Tabs** — Multiple shell sessions per project, drag to reorder, auto-saved active tab.
- **Built-in editor** — Monaco-powered file editor with syntax highlighting. Auto-refreshes on external changes.
- **Git diff viewer** — Side-by-side diff view for staged and unstaged changes.
- **Agent messaging** — CLI-driven inter-tab messaging with `send`, `inbox`, `wait`, and `feed`. Build AI agent workflows that spawn tabs and exchange results.
- **Notifications** — Browser notifications, toast popups, and a notification center. Flag important notifications to highlight tab dots.
- **Custom shortcuts** — Bind frequently used commands to the shortcut bar.
- **Mobile friendly** — Touch-optimized with on-screen key bar (Ctrl, Alt, Esc, Tab, arrows, symbols), swipe to switch tabs, long-press to reorder.
- **Single binary** — Frontend is embedded in the Go binary via `go:embed`.

## Quick Start

```bash
# Prerequisites: Go 1.22+, Node.js 20+
git clone https://github.com/cookieshake/gosok-terminal.git
cd gosok-terminal
make build
./bin/gosok
```

Open `http://localhost:18435` in your browser.

### Docker

```bash
docker build -t gosok-terminal .
docker run -p 18435:18435 -v gosok-data:/data gosok-terminal
```

### Development

```bash
flox activate       # set up Go + Node.js via Flox
make dev            # backend + frontend with hot reload
make test           # go test ./...
make lint           # go vet + eslint
```

## CLI

The `gosok` binary is both the server and the CLI client. Run without arguments to start the server; with a subcommand to interact with a running instance.

### Projects & Tabs

```bash
gosok projects                              # list all projects
gosok project create my-app --path /code    # create a project
gosok project update <id> --name new-name   # rename
gosok project delete <id>                   # delete

gosok tabs [project]                        # list tabs
gosok tab create <project-id> --name dev    # create a tab
gosok tab start <id>                        # start shell
gosok tab stop <id>                         # stop shell
gosok tab delete <id>                       # delete
```

### Messaging

```bash
gosok send <tab-id> "npm test"              # direct message
gosok send --all "deploy done"              # broadcast
gosok feed "v2.1 released"                  # post to global feed
gosok feed                                  # read feed
gosok inbox                                 # read inbox
gosok inbox read                            # mark as read
gosok wait --timeout 60s                    # block until message arrives
```

### Notifications

```bash
gosok notify "Build Done" --body "All tests passed"         # notification only
gosok notify "Build Done" --body "All tests passed" --flag  # + highlight tab dot
```

### Settings

```bash
gosok setting list                          # list all
gosok setting get terminal_font_size        # get value
gosok setting set terminal_font_size 16     # set value
gosok setting delete terminal_font_size     # reset to default
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOSOK_PORT` | `18435` | Server port |
| `GOSOK_DB_PATH` | `~/.gosok/gosok.db` | SQLite database path |
| `GOSOK_TAB_ID` | _(auto)_ | Current tab ID (injected in each tab) |
| `GOSOK_API_URL` | _(auto)_ | Server URL (injected in each tab) |

## Agent Integration

gosok is designed for AI agent workflows. An agent can programmatically create projects, spawn tabs, execute commands, and wait for results:

```bash
# Create a workspace
proj=$(gosok project create test-run --path /tmp/test | awk '{print $2}')
tab=$(gosok tab create $proj --name runner | awk '{print $2}')
gosok tab start $tab

# Run a command and wait for response
gosok send $tab "npm test && gosok notify done --flag"
gosok wait --timeout 120s $tab
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go, gorilla/websocket, SQLite, creack/pty |
| Frontend | React 19, TypeScript, xterm.js 6, TailwindCSS 4, Vite |
| Build | `go:embed` (frontend embedded in binary) |

## License

[MIT](LICENSE)
