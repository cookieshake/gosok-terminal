# gosok-terminal

A web-based terminal multiplexer with inter-tab messaging. Go backend + React frontend, shipped as a single binary.

![gosok-terminal screenshot](screenshot.png)

## Features

- **Project workspaces** — Organize terminals by project. Shell sessions stay alive when you switch.
- **Tabs** — Multiple shell sessions per project, drag to reorder, remembers your last active tab.
- **Inter-tab messaging** — Send messages between tabs via CLI (`send`, `inbox`, `wait`, `feed`).
- **Built-in editor** — Monaco-powered file editor with syntax highlighting. Reloads files when you switch tabs.
- **Git diff viewer** — Side-by-side diff view for staged and unstaged changes.
- **Notifications** — Browser notifications, toast popups, and a notification center. Use `--flag` to mark a tab as needing attention.
- **Settings UI** — Configure terminal/editor font, text scale, and custom shortcuts from the browser.
- **Mobile support** — On-screen shortcut bar, swipe to switch tabs, long-press to reorder.
- **Single binary** — Frontend embedded via `go:embed`. One file to deploy.

## Quick Start

```bash
# Prerequisites: Go 1.25+, Node.js 22+
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

> **Security warning:** gosok binds to all interfaces (`0.0.0.0`) by default and has no built-in authentication. Do not expose it to untrusted networks.

### Development

```bash
flox activate       # set up Go + Node.js via Flox
make dev            # backend + frontend with hot reload
make test           # go test ./...
make lint           # go vet + eslint
```

## CLI

The `gosok` binary is both the server and the CLI client. Run it without arguments to start the server, or with a subcommand to interact with a running instance.

Each tab's shell gets `GOSOK_TAB_ID` and `GOSOK_API_URL` automatically, so CLI commands just work from inside tabs.

```bash
# Projects
gosok projects                              # list (alias: ps)
gosok project create my-app --path /code    # create
gosok project update <id> --name n --path p # update
gosok project delete <id>                   # delete

# Tabs
gosok tabs [project]                        # list (alias: ls)
gosok tab create <project-id> --name dev    # create
gosok tab start <id>                        # start shell
gosok tab stop <id>                         # stop shell
gosok tab update <id> --name new-name       # rename
gosok tab delete <id>                       # delete

# Messaging (delivers text to inbox, does not execute commands)
gosok send <tab-id> "build done"            # direct message
gosok send --all "deploy done"              # broadcast
gosok feed "v2.1 released"                  # post to global feed
gosok inbox                                 # read inbox
gosok wait --timeout 60s                    # block until message arrives

# Notifications
gosok notify "Build Done" --body "All tests passed"         # notification
gosok notify "Build Done" --body "All tests passed" --flag  # + mark tab

# Settings
gosok setting list / get <key> / set <key> <val> / delete <key>

# Help
gosok help
```

See the [full CLI reference](website/src/content/docs/cli/index.md) for details.

## Scripting Example

```bash
proj=$(gosok project create test-run --path /tmp/test | awk '{print $2}')
tab=$(gosok tab create $proj --name runner | awk '{print $2}')
gosok tab start $tab
gosok send $tab "run tests"
gosok wait --timeout 120s $tab
gosok notify "Tests Complete" --flag
```

`send` delivers a text message to the tab's inbox. The tab must read from its inbox (via `gosok wait` or `gosok inbox`) to act on it. Messaging doesn't execute commands — tabs read and act on messages themselves.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOSOK_PORT` | `18435` | Server port |
| `GOSOK_DB_PATH` | `~/.gosok/gosok.db` | SQLite database path |
| `GOSOK_TAB_ID` | _(set by gosok)_ | ULID of the current tab. Set in every shell spawned by gosok. |
| `GOSOK_API_URL` | _(set by gosok)_ | Base URL of the running server. Used by CLI commands inside tabs. |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go, gorilla/websocket, SQLite, creack/pty |
| Frontend | React 19, TypeScript, xterm.js 6, Monaco Editor, TailwindCSS 4, Vite |
| Build | `go:embed` (frontend embedded in binary) |

## License

[MIT](LICENSE)
