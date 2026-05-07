# 4. Solution Strategy

## Key Decisions

### Why Go?

| Alternative | Rejected Because |
|------------|-----------------|
| Rust | Higher complexity for a tool that primarily orchestrates PTY and HTTP |
| Node.js | PTY management less mature; single-threaded model complicates concurrent sessions |
| Python | Performance overhead for terminal I/O; packaging complexity |

Go provides excellent PTY support (`creack/pty`), trivial cross-compilation, and `go:embed` for single-binary distribution.

### Why SQLite?

| Alternative | Rejected Because |
|------------|-----------------|
| PostgreSQL | Requires external process; overkill for local-first tool |
| File-based JSON | No concurrent access safety; no query capability |
| BoltDB | Limited query flexibility compared to SQL |

SQLite with WAL mode provides ACID transactions, concurrent reads, and zero-config deployment.

### Why Embedded Frontend?

| Alternative | Rejected Because |
|------------|-----------------|
| Separate frontend server | Complicates deployment; two processes to manage |
| Server-side rendering | Terminal UI requires rich client-side interaction |
| Electron | Heavy; not web-accessible from other devices |

`go:embed` bundles the React SPA into the binary. In production, Go serves static files directly. In development, Vite's dev server proxies API requests.

### Why WebSocket for Terminal I/O?

| Alternative | Rejected Because |
|------------|-----------------|
| HTTP polling | Unacceptable latency for interactive terminal |
| Server-Sent Events | Unidirectional; cannot send input to PTY |
| gRPC streaming | Browser support requires grpc-web proxy |

WebSocket provides full-duplex, low-latency binary streaming ideal for terminal I/O.

### Why VT Emulator as Scrollback Source?

| Alternative | Rejected Because |
|------------|-----------------|
| Raw byte ring buffer | Mid-stream truncation breaks CSI/OSC; alt-screen state diverges from current screen on reconnect |
| File-based log | Adds I/O overhead; complicates cleanup |
| No scrollback | Cannot reconnect without losing context |

Each PTY session feeds a `charm/x/vt` emulator under `dispatchMu`. On subscribe (and on subscriber overflow) the server synthesizes a self-contained byte sequence — RIS + active DECSET modes + emulator scrollback rows + active screen + cursor + title/cwd — that brings any reconnecting xterm-class client into exact VT state after `terminal.reset()`. Memory is bounded by the emulator's own scrollback limit; alt-screen and DECSET modes survive across reconnects without any byte-offset accounting.
