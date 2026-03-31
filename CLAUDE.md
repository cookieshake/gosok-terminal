# gosok-terminal

Web-based terminal multiplexer. Go backend + React frontend, served as a single binary.

## Environment Setup

Dev dependencies (Go, Node.js) are managed via **Flox**:

```bash
flox activate  # activate dev environment before any work
```

Do NOT install Go or Node.js directly — use Flox.

## Commands

```bash
# Development (runs backend + frontend concurrently)
make dev

# Backend only
make dev-backend   # go run ./cmd/gosok/

# Frontend only
make dev-frontend  # cd frontend && npm run dev

# Production build (embeds frontend into Go binary)
make build         # outputs bin/gosok

# Tests
make test          # go test ./...

# Lint
make lint          # go vet + eslint
```

Frontend dev server proxies API to Go backend. Go backend runs on port **18435** (env: `GOSOK_PORT`).

## Architecture

```
cmd/gosok/          # entry point + embedded frontend (fs.FS)
internal/
  api/              # REST handlers (projects, tabs, lifecycle)
  ws/               # WebSocket handler (terminal I/O)
  pty/              # PTY session management + ring buffer
  tab/              # tab lifecycle (create/start/stop/restart)
  project/          # project CRUD
  store/            # SQLite abstraction
  server/           # HTTP server + static file serving
frontend/src/
  components/       # React components (TerminalPane, ProjectView, Sidebar, TerminalTabs)
  api/              # API client (typed HTTP helpers)
  hooks/            # custom hooks
```

## Key Details

- **Database:** `~/.gosok/gosok.db` (env: `GOSOK_DB_PATH`)
- **IDs:** ULIDs (sortable) via `oklog/ulid`
- **Terminal:** xterm.js with WebGL renderer + fit addon
- **Build:** frontend `dist/` is copied into `cmd/gosok/dist/` then embedded via `//go:embed`; `dist/` is gitignored in that location
- **WebSocket:** gorilla/websocket; keepalive via ping/pong
- **Styling:** TailwindCSS v4, Base UI (headless), Geist font

## Frontend Stack

- React 19, React Router 7, TypeScript
- xterm.js 6
- TailwindCSS 4, Base UI, Lucide icons
- Vite 8 (build tool)
