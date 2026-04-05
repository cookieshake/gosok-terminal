---
title: Installation
description: How to install gosok
---

## Download Binary

Pre-built binaries are available on the [Releases](https://github.com/cookieshake/gosok-terminal/releases) page.

```bash
# macOS (Apple Silicon)
curl -Lo gosok https://github.com/cookieshake/gosok-terminal/releases/latest/download/gosok-darwin-arm64
chmod +x gosok
./gosok

# macOS (Intel)
curl -Lo gosok https://github.com/cookieshake/gosok-terminal/releases/latest/download/gosok-darwin-amd64

# Linux (x86_64)
curl -Lo gosok https://github.com/cookieshake/gosok-terminal/releases/latest/download/gosok-linux-amd64

# Linux (ARM64)
curl -Lo gosok https://github.com/cookieshake/gosok-terminal/releases/latest/download/gosok-linux-arm64
```

The server starts on port **18435** by default. Open `http://localhost:18435` in your browser.

## Docker

```bash
docker build -t gosok-terminal .
docker run -p 18435:18435 -v gosok-data:/data gosok-terminal
```

## Build from Source

Prerequisites: **Go 1.25+**, **Node.js 22+**

If you use [Flox](https://flox.dev), both are managed automatically with `flox activate`.

```bash
git clone https://github.com/cookieshake/gosok-terminal.git
cd gosok-terminal
make build
./bin/gosok
```

This produces a single binary at `bin/gosok` with the frontend embedded.

:::caution[Security]
gosok binds to all interfaces (`0.0.0.0`) by default and has **no built-in authentication**. Do not expose it to untrusted networks. Use a reverse proxy with authentication if you need remote access.
:::

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOSOK_PORT` | `18435` | Server port |
| `GOSOK_DB_PATH` | `~/.gosok/gosok.db` | SQLite database path |
| `GOSOK_API_URL` | `http://localhost:18435` | API URL for CLI commands |
