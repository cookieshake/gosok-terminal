# 3. Context

## System Boundary

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│  ┌─────────────┐  ┌──────────┐  ┌────────────┐ │
│  │  xterm.js   │  │  Monaco  │  │  React UI  │ │
│  │  (terminal) │  │ (editor) │  │            │ │
│  └──────┬──────┘  └────┬─────┘  └─────┬──────┘ │
│         │ WS           │ HTTP         │ HTTP    │
└─────────┼──────────────┼─────────────┼──────────┘
          │              │             │
┌─────────┼──────────────┼─────────────┼──────────┐
│         ▼              ▼             ▼          │
│  ┌─────────────────────────────────────────┐    │
│  │           HTTP Server (mux)             │    │
│  │  /api/ws/*  │  /api/v1/*  │  /*static   │    │
│  └──────┬──────┴──────┬──────┴──────┬──────┘    │
│         │             │             │           │
│         ▼             ▼             ▼           │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│  │  WS Hub   │ │  REST API │ │  Embedded  │     │
│  │           │ │  Handlers │ │  Frontend  │     │
│  └─────┬─────┘ └─────┬─────┘ └───────────┘     │
│        │              │                         │
│        ▼              ▼                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│  │    PTY    │ │   Store   │ │  Events   │     │
│  │  Manager  │ │  (SQLite) │ │   Hub     │     │
│  └─────┬─────┘ └───────────┘ └───────────┘     │
│        │                                        │
│        ▼                                        │
│  ┌───────────┐                                  │
│  │  OS PTY   │                                  │
│  │ Processes │                                  │
│  └───────────┘                                  │
│                  gosok-terminal binary           │
└─────────────────────────────────────────────────┘
```

## External Integrations

| System | Interface | Purpose |
|--------|-----------|---------|
| OS PTY | `creack/pty` | Spawns and manages pseudo-terminal processes |
| Filesystem | Go `os` package | File browsing, reading, writing for editor feature |
| AI Tools | Spawned as child processes | Claude Code, Codex, Gemini CLI, OpenCode run inside PTY |

## Clients

| Client | Protocol | Description |
|--------|----------|-------------|
| Browser | HTTP + WebSocket | Primary UI via embedded React SPA |
| CLI | HTTP | Embedded CLI commands call REST API on localhost (subset of operations) |
