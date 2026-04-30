# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Web-based terminal multiplexer. A Go backend serves a React frontend as a single self-contained binary. Users manage projects (directories) and tabs (PTY sessions) through a browser UI.

## Environment

Dev dependencies (Go, Node.js) are managed via **Flox**. Always activate before working:

```bash
flox activate
```

Do not install Go or Node.js directly.

## Commands

```bash
make dev            # backend + frontend concurrently (hot reload)
make dev-backend    # Go only: go run ./cmd/gosok/
make dev-frontend   # frontend only: cd frontend && npm run dev
make build          # production binary → bin/gosok
make test           # go test ./...
make lint           # go vet + eslint
```

Backend: port **18435** (`GOSOK_PORT`). Frontend dev server proxies API calls to it.

### Running a single Go test

```bash
go test ./internal/pty/ -run TestRingBuffer -v
```

### E2E tests (Playwright)

Requires a built binary (`make build`) before running:

```bash
cd tests/e2e
npx playwright test                        # all specs
npx playwright test terminal.spec.ts       # one file
npx playwright test --grep "SC.TERM.5"    # one scenario
```

E2E config starts `bin/gosok` on port 18436 with a temp DB. `tests/e2e/helpers/` provides `ApiHelper`, `UiHelper`, `TerminalHelper` — use them instead of raw Playwright selectors.

### Integration tests

```bash
go test ./tests/integration/... -v -run TestProjects
```

Integration tests build the binary themselves (`TestMain` in `main_test.go`).

## Architecture

### Request path

```
Browser
  → HTTP/WS → internal/server  (routes, mounts api + ws + static)
  → internal/api               (REST handlers: projects, tabs, settings, notify)
  → internal/ws                (WebSocket handlers: terminal I/O, events stream)
  → internal/tab               (tab lifecycle: create/start/stop/restart)
  → internal/pty               (PTY sessions + ring buffer)
  → internal/store             (SQLite via internal/store/sqlite.go)
```

### Key packages

| Package | Responsibility |
|---------|---------------|
| `cmd/gosok/` | Entry point. Embeds `dist/` via `//go:embed`. Also the CLI (`gosok notify`, `gosok send`, `gosok tab`, etc.) |
| `internal/server/` | Wires everything: creates `pty.Manager`, `tab.Service`, `events.Hub`, registers routes |
| `internal/api/` | REST handlers. Settings defaults live in `api.DefaultSettings` |
| `internal/ws/` | Three WS endpoints: terminal I/O (`/api/ws/sessions/{id}/terminal`), events stream (`/api/ws/events`), demo shell (`/api/ws/demo`) |
| `internal/pty/` | PTY session lifecycle + 1 MiB ring buffer (`BytesSince(offset)` for scrollback) |
| `internal/tab/` | Tab state machine on top of pty. Handles start/stop/restart |
| `internal/events/` | In-process pub/sub hub for messages and notifications |
| `internal/messaging/` | Message persistence + 7-day cleanup loop |
| `internal/store/` | `Store` interface + SQLite implementation |

### Frontend

`frontend/src/` structure that matters:

- `contexts/EventsContext.tsx` — WebSocket connection to `/api/ws/events`, auto-reconnects with exponential backoff (1 s → 30 s). Every reconnect reattaches all handlers to the new socket.
- `contexts/SettingsContext.tsx` — fetches all settings on load, provides `getSetting<T>` / `setSetting`.
- `components/TerminalPane.tsx` — xterm.js terminal, PTY WebSocket, keyboard routing, mobile viewport handling.
- `hooks/useEvents.ts` — low-level events WS hook used by `EventsContext`.

### Build embedding

`make build` copies `frontend/dist/` into `cmd/gosok/dist/`, builds the binary (which embeds it via `//go:embed all:dist`), then deletes the copy. The `dist/` inside `cmd/gosok/` is gitignored.

## Key Behaviours to Know

**Keyboard routing** (`TerminalPane.tsx`): macOS sends `Cmd+A/V/F` to the browser; all `Ctrl+*` goes to the PTY. Windows/Linux sends `Ctrl+V/F` to the browser; `Ctrl+A` goes to the PTY. `Ctrl+C`/`Cmd+C` goes to the browser only when text is selected.

**Mobile viewport**: `Layout.tsx` listens to `visualViewport` resize/scroll. When the viewport grows (soft keyboard closes) and `scrollY > 0`, it calls `window.scrollTo(0, 0)` in a `requestAnimationFrame`.

**Scrollback sync**: 1 MiB ring buffer per PTY session. On WS connect the client sends its current byte offset; the server calls `BytesSince(offset)` and streams the diff immediately. If the offset has been overwritten (older than capacity), the server sends the full buffer.

**Subscriber drop policy**: PTY subscribers have a 256-slot buffered channel; events hub subscribers have 64 slots. When the channel is full the message is dropped (non-blocking send). Clients recover via the offset-based resync above (PTY) or by reconnecting (events).

**WS keepalive**: server sends ping every 30 s; if no pong within 10 s, it closes the connection. Application-level `{type: "ping"/"pong"}` JSON is also supported.

**PTY lifecycle**: `tab stop` sends SIGINT (`os.Interrupt`). When the process exits on its own, subscribers are notified via `OutputEvent` with `Data == nil` carrying the exit code, and the tab transitions to `stopped`.

**Settings**: Key-value store in SQLite (JSON values). Defaults are seeded at startup only if the key is absent. `DELETE /api/v1/settings/{key}` removes the override; the default is returned on next read.

**Message retention**: a background goroutine runs every 24 h and deletes messages older than 7 days. Notifications are not persisted (event-only).

**CLI → API**: CLI subcommands hit the REST API on `GOSOK_API_URL` (default `http://localhost:18435`).

**IDs**: ULIDs everywhere via `oklog/ulid`.

## Spec

`spec/architecture/` holds the Arc42 system overview. Behaviour is no longer maintained as separate spec docs — tests under `tests/e2e/` and `tests/integration/` are the source of truth, and stable invariants live in this file. Some test names still carry legacy `SC.<DOMAIN>.N` IDs you can grep with `--grep`.
