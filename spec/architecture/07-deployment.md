# 7. Deployment

## Build

```bash
# Production build: compiles frontend, embeds into Go binary
make build    # outputs bin/gosok
```

Build process:
1. `cd frontend && npm run build` → produces `frontend/dist/`
2. Copy `frontend/dist/` → `cmd/gosok/dist/`
3. `go build -o bin/gosok ./cmd/gosok/` → embeds `dist/` via `//go:embed`

## Execution

```bash
# Start server (default port 18435)
./bin/gosok

# Custom port
GOSOK_PORT=9000 ./bin/gosok

# Custom database path
GOSOK_DB_PATH=/path/to/gosok.db ./bin/gosok
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOSOK_PORT` | `18435` | HTTP server listen port |
| `GOSOK_DB_PATH` | `~/.gosok/gosok.db` | SQLite database file path |

## Injected Environment (per tab)

Each tab process receives the following environment variables:

| Variable | Description |
|----------|-------------|
| `GOSOK_TAB_ID` | Current tab ULID |
| `GOSOK_TAB_NAME` | Current tab name |
| `GOSOK_PROJECT_NAME` | Parent project name |
| `GOSOK_API_URL` | API base URL (e.g., `http://localhost:18435`) |
| `GOSOK_BIN` | Path to gosok binary |

## Development

```bash
flox activate          # activate dev environment (Go, Node.js)
make dev               # runs backend + frontend concurrently
make dev-backend       # Go backend only (port 18435)
make dev-frontend      # Vite dev server (proxies /api to backend)
```

## Database

- Auto-created on first run at `GOSOK_DB_PATH`
- Schema migrations run automatically on startup
- WAL mode enabled for concurrent read access
- Foreign keys enforced
