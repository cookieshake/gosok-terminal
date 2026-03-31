---
title: Installation
description: How to install gosok
---

## Prerequisites

- **Go** 1.22+
- **Node.js** 20+

If you use [Flox](https://flox.dev), both are managed automatically:

```bash
flox activate
```

## Build from Source

```bash
git clone https://github.com/cookieshake/gosok-terminal.git
cd gosok-terminal
make build
```

This produces a single binary at `bin/gosok` with the frontend embedded.

## Run

```bash
./bin/gosok
```

The server starts on port **18435** by default. Open `http://localhost:18435` in your browser.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOSOK_PORT` | `18435` | Server port |
| `GOSOK_DB_PATH` | `~/.gosok/gosok.db` | SQLite database path |
| `GOSOK_API_URL` | `http://localhost:18435` | API URL for CLI commands |
