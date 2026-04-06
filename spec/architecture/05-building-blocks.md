# 5. Building Blocks

## Module Structure

```
cmd/gosok/
  main.go              ← Entry point, CLI commands, embedded frontend

internal/
  server/              ← HTTP server setup, routing, static file serving
  api/                 ← REST API handlers
  ws/                  ← WebSocket handler for terminal I/O
  pty/                 ← PTY session management + ring buffer
  tab/                 ← Tab lifecycle (start/stop/restart)
  store/               ← SQLite database abstraction
  events/              ← Pub/sub event hub
  messaging/           ← Message service (send, query, read markers)

frontend/src/
  components/          ← React UI components
  api/                 ← HTTP/WS client
  hooks/               ← Custom React hooks
  contexts/            ← React contexts (events, settings)
```

## Module Roles

| Module | Role | Dependencies |
|--------|------|-------------|
| `cmd/gosok` | CLI entry point, embeds frontend, wires dependencies | server, api, tab, store, pty, events, messaging |
| `server` | HTTP mux setup, CORS, static file serving | - |
| `api` | REST endpoint handlers | store, tab, pty, events, messaging |
| `ws` | WebSocket terminal I/O, ping/pong, sync protocol | pty |
| `pty` | PTY process management, ring buffer, subscriber broadcast | - |
| `tab` | Tab lifecycle orchestration, env injection | pty, store |
| `store` | SQLite schema, migrations, all database operations | - |
| `events` | In-memory pub/sub hub for real-time notifications | - |
| `messaging` | Message send/query, read markers, cleanup | store, events |

## REST API Endpoints

### Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/projects` | List all projects |
| POST | `/api/v1/projects` | Create project |
| GET | `/api/v1/projects/{id}` | Get project |
| PUT | `/api/v1/projects/{id}` | Update project |
| DELETE | `/api/v1/projects/{id}` | Delete project |
| PUT | `/api/v1/projects/reorder` | Reorder projects |

### Tabs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/projects/{projectID}/tabs` | List tabs |
| POST | `/api/v1/projects/{projectID}/tabs` | Create tab |
| GET | `/api/v1/tabs/{id}` | Get tab |
| PUT | `/api/v1/tabs/{id}` | Update tab |
| DELETE | `/api/v1/tabs/{id}` | Delete tab |
| POST | `/api/v1/tabs/{id}/start` | Start tab |
| POST | `/api/v1/tabs/{id}/stop` | Stop tab |
| POST | `/api/v1/tabs/{id}/restart` | Restart tab |
| PUT | `/api/v1/tabs/{id}/title` | Update dynamic title |
| POST | `/api/v1/tabs/{id}/write` | Write to tab PTY |
| PUT | `/api/v1/tabs/reorder` | Reorder tabs |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/settings` | List all settings |
| GET | `/api/v1/settings/{key}` | Get setting (falls back to default) |
| PUT | `/api/v1/settings/{key}` | Set setting |
| DELETE | `/api/v1/settings/{key}` | Reset setting to default |

### Messages

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/messages` | Send message |
| GET | `/api/v1/messages/inbox/{tabID}` | Get tab inbox |
| GET | `/api/v1/messages/inbox/{tabID}/wait` | Long-poll wait for inbox |
| GET | `/api/v1/messages/feed` | Get feed |
| PUT | `/api/v1/messages/inbox/{tabID}/read` | Mark inbox as read |
| PUT | `/api/v1/messages/feed/read/{tabID}` | Mark feed as read |

### Other

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/notify` | Send notification |
| GET | `/api/v1/fs/dirs` | List directories |
| GET | `/api/v1/fs/files` | List files |
| GET | `/api/v1/fs/file` | Read file |
| PUT | `/api/v1/fs/file` | Write file |
| GET | `/api/v1/projects/{id}/diff` | Get git diff |
| GET | `/api/v1/projects/{id}/diff/file` | Get single file diff |
| GET | `/api/v1/tabs/{id}/screen` | Get terminal screen content |
| GET | `/api/v1/health` | Health check |

### WebSocket

| Path | Description |
|------|-------------|
| `/api/ws/sessions/{sessionID}/terminal` | Terminal I/O for a PTY session |
| `/api/ws/events` | Server-sent events (messages, notifications) |
| `/api/ws/demo` | Demo terminal session |
