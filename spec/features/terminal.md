# Terminal

### [TERM.1] PTY Session

**rules**:
- Each PTY session MUST be identified by a ULID.
- A session MUST wrap a single OS process with a pseudo-terminal.
- The session MUST spawn a goroutine that reads PTY output in 32 KB chunks.
- Output MUST be written to a ring buffer and broadcast to all subscribers.
- When the process exits, all subscribers MUST be notified with the exit code.
- The PTY Manager MUST track all active sessions and support cleanup on shutdown.

**fields**:

| Name | Type | Description |
|------|------|-------------|
| id | ULID | Session identifier |
| cmd | exec.Cmd | Wrapped OS command |
| pty | *os.File | PTY file descriptor |
| ring | RingBuffer | Circular output buffer |
| subscribers | map | Active subscriber channels |

**errors**:
- Session not found → error returned to caller
- PTY creation failure → error returned to caller

---

### [TERM.2] Ring Buffer

**rules**:
- The ring buffer MUST have a fixed capacity of 1 MiB.
- The buffer MUST track a cumulative offset (uint64) representing total bytes written.
- `BytesSince(offset)` MUST return bytes written since the given offset.
- If the requested offset has been overwritten (older than buffer capacity), the full buffer contents MUST be returned with a flag indicating full replay.
- Write operations MUST be thread-safe.

**fields**:

| Name | Type | Description |
|------|------|-------------|
| capacity | int | Buffer size (1,048,576 bytes) |
| offset | uint64 | Cumulative bytes written |
| data | []byte | Circular buffer storage |

---

### [TERM.3] Subscriber

**rules**:
- A subscriber MUST receive PTY output via a buffered channel (256 slots).
- If the subscriber's channel is full, the message MUST be dropped (non-blocking send).
- When a message is dropped, the subscriber MUST resync via the ring buffer on next opportunity.
- Subscribers MUST receive messages via a single `OutputEvent` struct. When `Data` is non-nil, the message contains PTY output. When `Data` is nil, the message indicates process exit (with the exit code in the `ExitCode` field).

**fields**:

| Name | Type | Description |
|------|------|-------------|
| ch | chan Message | Buffered channel (256) |

---

### [TERM.4] PTY Resize

**rules**:
- The PTY MUST support resizing via `Setsize(cols, rows)`.
- Resize requests come from WebSocket control messages.

**refs**:
- WS.1 (resize control message)
