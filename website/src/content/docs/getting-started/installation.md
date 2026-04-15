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
xattr -d com.apple.quarantine gosok  # remove macOS Gatekeeper quarantine flag
./gosok

# macOS (Intel)
curl -Lo gosok https://github.com/cookieshake/gosok-terminal/releases/latest/download/gosok-darwin-amd64
chmod +x gosok
xattr -d com.apple.quarantine gosok  # remove macOS Gatekeeper quarantine flag

# Linux (x86_64)
curl -Lo gosok https://github.com/cookieshake/gosok-terminal/releases/latest/download/gosok-linux-amd64
chmod +x gosok

# Linux (ARM64)
curl -Lo gosok https://github.com/cookieshake/gosok-terminal/releases/latest/download/gosok-linux-arm64
chmod +x gosok
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

:::note[Security]
gosok binds to `127.0.0.1` (localhost only) by default. To allow remote access, set `GOSOK_HOST=0.0.0.0` and connect through a VPN such as Tailscale or WireGuard. There is no built-in authentication.
:::

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOSOK_HOST` | `127.0.0.1` | Bind address (`0.0.0.0` to expose externally) |
| `GOSOK_PORT` | `18435` | Server port |
| `GOSOK_DB_PATH` | `~/.gosok/gosok.db` | SQLite database path |
| `GOSOK_API_URL` | `http://localhost:18435` | API URL for CLI commands |
