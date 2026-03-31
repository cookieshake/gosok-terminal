---
title: Introduction
description: What is gosok and why use it
---

**gosok** is a web-based terminal multiplexer built with Go and React, served as a single binary.

## Features

- **Multiple terminals** — Create projects with multiple tabs, each running its own shell session
- **Web-based** — Access your terminals from any browser, including mobile devices
- **Built-in editor** — Edit files and view git diffs without leaving the interface
- **Agent messaging** — Send and receive messages between tabs via CLI, enabling AI agent workflows
- **Notifications** — Browser notifications with toast popups and a notification center
- **Single binary** — The frontend is embedded in the Go binary. No separate web server needed.

## Architecture

```
┌─────────────────────────────────────────┐
│  Browser (React + xterm.js)             │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ Terminal  │ │ Editor   │ │  Diff   │ │
│  │  Tabs     │ │  Pane    │ │  Pane   │ │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │ WebSocket   │ REST       │ REST  │
├───────┼─────────────┼────────────┼──────┤
│  Go Backend                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ │
│  │ PTY  │ │ API  │ │ WS   │ │ Events │ │
│  │ Mgmt │ │      │ │ Hub  │ │  Hub   │ │
│  └──┬───┘ └──┬───┘ └──────┘ └────────┘ │
│     │        │                           │
│     │   ┌────┴────┐                      │
│     │   │ SQLite  │                      │
│     │   └─────────┘                      │
│     │                                    │
│  ┌──┴──────────────┐                    │
│  │  Shell (PTY)    │                    │
│  └─────────────────┘                    │
└──────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go, gorilla/websocket, SQLite |
| Frontend | React 19, TypeScript, xterm.js, TailwindCSS v4 |
| Build | Vite, `go:embed` |
| IDs | ULIDs (sortable) |
