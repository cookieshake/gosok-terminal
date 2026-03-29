# gosok-terminal

A web-based terminal multiplexer. Manage multiple terminal sessions in your browser, organized by projects.

![gosok-terminal screenshot](screenshot.png)

## Features

- **Project-based organization** — Group terminal tabs by project
- **Browser-based UI** — Access your terminals from any browser
- **Single binary** — Frontend embedded in the Go binary, no separate web server needed
- **Inter-tab messaging** — Send messages between tabs via CLI
- **Browser notifications** — Get notified when long-running tasks complete
- **Docker ready** — Multi-stage Dockerfile included

## Quick Start

### From source

```bash
# Prerequisites: Go 1.25+, Node.js 22+
make build
./bin/gosok
```

Open `http://localhost:18435` in your browser.

### Docker

```bash
docker build -t gosok-terminal .
docker run -p 18435:18435 -v gosok-data:/data gosok-terminal
```

## CLI Commands

The `gosok` binary doubles as a CLI for inter-tab communication:

```bash
gosok                                    # Start the server
gosok send <tab-id> <message>            # Send a direct message to a tab
gosok send --all <message>               # Broadcast to all tabs
gosok feed <message>                     # Post to the global feed
gosok feed                               # Read the global feed
gosok inbox [tab-id]                     # Read messages for a tab
gosok notify <title> [--body <text>]     # Send a browser notification
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOSOK_PORT` | `18435` | Server port |
| `GOSOK_DB_PATH` | `~/.gosok/gosok.db` | SQLite database path |
| `GOSOK_API_URL` | `http://localhost:18435` | API URL (used by CLI commands) |
| `GOSOK_TAB_ID` | — | Current tab ID (auto-injected in gosok tabs) |

## Development

```bash
make dev            # Run backend + frontend concurrently
make test           # Run tests
make lint           # Run linters
make build          # Production build
```

## Tech Stack

- **Backend:** Go, SQLite, WebSocket (gorilla/websocket), PTY (creack/pty)
- **Frontend:** React 19, TypeScript, xterm.js, TailwindCSS 4, Vite

## License

[MIT](LICENSE)
