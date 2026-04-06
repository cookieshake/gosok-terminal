# 1. Introduction and Goals

## Product Purpose

gosok-terminal is a web-based terminal multiplexer. It provides a browser UI for managing multiple terminal sessions organized by project, with built-in support for AI coding tools (Claude Code, Codex, Gemini CLI, OpenCode).

The system is distributed as a single Go binary that embeds both the backend API server and the React frontend.

## Key Requirements

1. **Project-based organization**: Group terminal tabs by project, each mapped to a filesystem path
2. **Multi-tab terminal**: Run multiple PTY sessions concurrently within each project
3. **AI tool integration**: First-class support for AI coding assistants as tab types
4. **Web-based access**: Full terminal experience in the browser via xterm.js
5. **Single binary deployment**: No separate frontend server or build step required in production
6. **Inter-tab messaging**: Tabs can communicate via scoped messages (direct, broadcast, global)
7. **CLI interface**: Core operations accessible from the embedded CLI (subset of web UI functionality)

## Quality Goals

| Priority | Goal | Description |
|----------|------|-------------|
| 1 | Responsiveness | Terminal I/O MUST feel instantaneous; WebSocket latency MUST be minimal |
| 2 | Reliability | PTY sessions MUST survive brief network interruptions via scrollback sync |
| 3 | Simplicity | Single binary, SQLite storage, no external dependencies |
| 4 | Extensibility | New tab types can be added without architectural changes |

## Stakeholders

| Role | Interest |
|------|----------|
| Developer (user) | Uses gosok-terminal to manage multiple terminal/AI sessions per project |
| Self-hoster | Runs the binary on a local or remote machine |
