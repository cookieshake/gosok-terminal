# 2. Constraints

## Technical Constraints

| Constraint | Detail |
|-----------|--------|
| Language | Go (backend), TypeScript/React (frontend) |
| Database | SQLite with WAL mode, foreign keys enabled |
| Terminal | PTY via `creack/pty`, xterm.js 6 in browser |
| WebSocket | `gorilla/websocket` for terminal I/O |
| IDs | ULID (`oklog/ulid`) for all entities |
| Build | Frontend `dist/` embedded into Go binary via `go:embed` |
| Dev environment | All dependencies managed via Flox |

## Non-Functional Requirements

### Performance

| Metric | Requirement |
|--------|-------------|
| PTY read buffer | 32 KB per read |
| Ring buffer size | 1 MiB per session |
| Subscriber channel | 256 slots, overflow drops with resync |
| WebSocket ping interval | 30 seconds |
| WebSocket pong timeout | 10 seconds |

### Storage

| Metric | Requirement |
|--------|-------------|
| Database location | `~/.gosok/gosok.db` (env: `GOSOK_DB_PATH`) |
| Message retention | 7 days, purged every 24 hours |

### Network

| Metric | Requirement |
|--------|-------------|
| API port | 18435 (env: `GOSOK_PORT`) |
| CORS | Allowed for all origins in dev mode |
| Frontend proxy | Vite dev server proxies `/api` to Go backend |
