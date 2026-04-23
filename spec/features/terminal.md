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

---

### [TERM.5] Keyboard Event Routing

**rules**:
- The terminal MUST intercept keyboard events before the browser processes them.
- On macOS (`navigator.platform` matches `/Mac|iPhone|iPod|iPad/i`), `Cmd+A`, `Cmd+V`, and `Cmd+F` MUST be passed to the browser (select-all, paste, find). All `Ctrl+*` combinations MUST be forwarded to the terminal PTY.
- On Windows/Linux (non-macOS), `Ctrl+V` and `Ctrl+F` MUST be passed to the browser (paste, find). `Ctrl+A` MUST be forwarded to the terminal PTY (readline: beginning-of-line).
- `Ctrl+C` / `Cmd+C` MUST be passed to the browser only when the terminal has a text selection. Without a selection, it MUST be forwarded to the PTY as SIGINT.

**notes**:
Implemented via xterm.js `attachCustomKeyEventHandler`. Returning `false` delegates the event to the browser; returning `true` forwards it to the PTY.

**refs**:
- WS.1 (PTY input)

---

### [TERM.6] Mobile Viewport Tracking

**rules**:
- The terminal pane (`TerminalPane.tsx`) MUST observe its container with `ResizeObserver` and react to every size change. When the observed size would shrink xterm in rows, it MUST only notify the PTY of the new (smaller) dimensions and leave xterm at its current larger size; otherwise it MUST call `fitAddon.fit()` and notify the PTY. After every resize it MUST align the bottom of xterm with the bottom of the visible area by setting `scrollTop` on the clip parent, so the cursor row stays on screen.
- On mobile, a tap on the terminal area MUST focus the hidden textarea to trigger the soft keyboard. A scroll or swipe gesture (start and end positions differing by ≥5 px in either axis) MUST NOT focus the textarea.
- A touchstart on the terminal area MUST blur the hidden textarea, so a subsequent scroll cannot re-open a keyboard that the user had manually dismissed while the textarea still held focus.

**notes**:
Shrinking xterm pushes viewport rows into its client-side scrollback, which a diff-rendering TUI (e.g. Ink / Claude Code) cannot erase on SIGWINCH. The asymmetric resize avoids that reflow path; the oversized xterm is clipped by the container's `overflow: hidden` and positioned so the cursor row stays visible.

**refs**:
- TERM.4 (PTY resize)
