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

### Why Ring Buffer for Scrollback?

| Alternative | Rejected Because |
|------------|-----------------|
| Unbounded buffer | Memory grows indefinitely for long-running sessions |
| File-based log | Adds I/O overhead; complicates cleanup |
| No scrollback | Cannot reconnect without losing context |

A 1 MiB circular buffer provides bounded memory with offset-based delta sync for reconnection.
