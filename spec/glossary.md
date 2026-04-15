# Glossary

| Term | Definition |
|------|-----------|
| Project | A workspace unit containing multiple tabs, mapped to a filesystem path |
| Tab | A terminal session unit within a project. Has a type (shell, claude-code, etc.) and lifecycle |
| PTY | Pseudo-terminal. OS-level terminal emulation used to run shell processes |
| Session | A PTY session identified by ULID, managing a single process and its I/O |
| Ring Buffer | Fixed-size circular buffer (1 MiB) storing PTY output for scrollback replay |
| Subscriber | A WebSocket client receiving PTY output from a session |
| Offset | Cumulative byte count in ring buffer, used for delta sync between client and server |
| Full Replay | When client offset is too old (overwritten in ring buffer), server sends entire buffer contents |
| Delta Sync | Sending only new bytes since client's last known offset |
| Tab Type | Category of tab determining the command to run. `shell` and `editor` are hardcoded; additional types (e.g., `claude-code`, `codex`, `gemini-cli`, `opencode`) are defined dynamically via `ai_tools` settings |
| OSC Title | Operating System Command escape sequence that dynamically updates tab title from the running process |
| Sort Order | Integer field controlling display order of projects and tabs |
| Scope | Message delivery scope: `direct` (one tab), `broadcast` (all tabs), `global` (all tabs via feed) |
| Read Marker | Tracks last read message ID per tab per channel (inbox/feed) |
| Feed | Message stream visible to all tabs, excluding direct messages |
| Inbox | Messages directly addressed to a specific tab |
| Shortcut | User-defined command with keyboard modifier, stored in settings |
| Settings | Key-value configuration store with JSON values and default fallback |
| ULID | Universally Unique Lexicographically Sortable Identifier |
| WebGL Renderer | GPU-accelerated xterm.js rendering backend |
| Fit Addon | xterm.js plugin that auto-sizes terminal to container dimensions |
| Keepalive | Periodic ping/pong exchange to detect dead WebSocket connections |
| Event Hub | Central publish/subscribe dispatcher that broadcasts events (messages, notifications, status changes) to WebSocket subscribers |
| Control Message | A JSON WebSocket message used for signaling between server and client (e.g., resize, ping/pong, exit) as opposed to binary terminal I/O data |
| Tab Status | Current state of a tab: `running` (active PTY session) or `stopped` (no active session) |
| Demo Session | An ephemeral PTY session created on WebSocket connect to `/api/ws/demo`, running a default shell. Destroyed when the client disconnects |
| Embedded Frontend | React SPA built into the Go binary via `go:embed` |
| WAL | Write-Ahead Logging mode for SQLite, enabling concurrent reads |
