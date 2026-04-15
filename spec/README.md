# gosok-terminal Specification

Web-based terminal multiplexer. Go backend + React frontend, served as a single binary.

## Structure and Writing Guide

See [spec-format.md](./spec-format.md).

## Glossary

See [glossary.md](./glossary.md).

## File Structure

```
spec/
├── README.md              ← This document
├── spec-format.md         # Spec format definition (generic)
├── glossary.md            # Glossary
│
├── architecture/          # System overview (Layer 1)
│   ├── 01-introduction.md
│   ├── 02-constraints.md
│   ├── 03-context.md
│   ├── 04-solution-strategy.md
│   ├── 05-building-blocks.md
│   ├── 06-runtime.md
│   └── 07-deployment.md
│
├── features/              # Feature-level detailed specs (Layer 2)
│   ├── projects.md        # Project CRUD, reorder
│   ├── tabs.md            # Tab lifecycle, types, env injection
│   ├── terminal.md        # PTY session, ring buffer, subscription
│   ├── websocket.md       # WS protocol, sync, keepalive
│   ├── messaging.md       # Message scopes, read markers, cleanup
│   ├── notifications.md   # Notifications
│   ├── settings.md        # Settings CRUD, defaults
│   ├── filesystem.md      # File/dir listing, read/write
│   ├── api.md             # REST common (response format, errors, CORS, health)
│   └── cli.md             # CLI commands
│
└── scenarios/             # User behavior scenarios (Layer 3)
    ├── projects.md
    ├── tabs.md
    ├── terminal.md
    ├── websocket.md
    ├── messaging.md
    ├── notifications.md
    ├── settings.md
    ├── filesystem.md
    ├── api.md
    └── cli.md
```
