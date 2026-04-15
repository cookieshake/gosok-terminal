# WebSocket

### [WS.1] Terminal WebSocket Protocol

**rules**:
- The terminal WebSocket endpoint is `/api/ws/sessions/{sessionID}/terminal`.
- Binary messages from the client MUST be written to the PTY stdin.
- Binary messages from the server are PTY output.
- Text messages MUST be JSON control messages.
- Control message types: `resize`, `ping`, `pong`, `sync`, `exit`.

**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| type | string | Y | Message type: resize, ping, pong, sync, exit |
| cols | integer | - | Terminal columns (resize only) |
| rows | integer | - | Terminal rows (resize only) |
| code | integer | - | Exit code (exit only) |
| message | string | - | Optional message payload |
| offset | uint64 | - | Authoritative server buffer offset (sync only) |
| replaySize | integer | - | Byte length of the binary replay message that immediately follows (sync only) |

**errors**:
- Session not found → WebSocket close with error
- Invalid JSON control message → ignored

**refs**:
- TERM.1 (PTY session)
- TERM.4 (resize)

---

### [WS.2] Keepalive

**rules**:
- The server MUST send a WebSocket ping frame every 30 seconds.
- The client MUST respond with a pong frame.
- If no pong is received within 10 seconds, the server MUST close the connection.
- Application-level ping/pong (JSON `{type: "ping"}` / `{type: "pong"}`) is also supported.

---

### [WS.3] Scrollback Sync

**rules**:
- Scrollback sync happens at connection time and on subscriber resync (dropped events).
- The client MUST include its current byte offset in the hello message when connecting.
- The server MUST use the client's initial offset to retrieve buffered data via `BytesSince(offset)` from the ring buffer.
- After subscribing, the server MUST send a `sync` JSON control message containing the authoritative `offset` (current ring buffer offset) and `replaySize` (byte length of the binary replay that follows).
- If `replaySize > 0`, the server MUST immediately follow the sync message with a single binary message containing the replay data.
- If the requested offset has been overwritten (older than buffer capacity), the server MUST send the full buffer contents as the replay data.
- When a subscriber drops events (channel full), the server MUST send a new `sync` + replay binary to resync the client to the current ring buffer state.
- The client MUST NOT add replay bytes to its tracked `serverOffset`. The sync message already sets `serverOffset = msg.offset`; only live event bytes received after the replay MUST increment `serverOffset`.
- The client MUST defer `terminal.reset()` until just before writing the replay binary (not at sync message receipt) to avoid xterm's async write-queue flushing stale data onto the cleared terminal.
- The client MUST reset the terminal display if `msg.offset !== serverOffset && serverOffset > 0` (offset mismatch indicates a full replay is needed).

**refs**:
- TERM.2 (ring buffer, BytesSince)
- TERM.3 (subscriber, dropped events)

---

### [WS.4] Events WebSocket

**rules**:
- The events WebSocket endpoint is `/api/ws/events`.
- The server MUST push all events from the Event Hub to connected clients.
- Events are JSON messages with a `type` field (`message` or `notification`).
- The subscriber channel MUST be buffered (64 slots).
- If the channel is full, events MUST be dropped.
- The client MUST automatically reconnect when the connection closes, using exponential backoff starting at 1 second and capping at 30 seconds.
- On each reconnect, the client MUST reattach all event handlers (`onopen`, `onclose`, `onmessage`) to the new WebSocket instance.
- On successful connection, the reconnect delay MUST be reset to 1 second.
- Subscription is implicit: connecting to the endpoint activates event delivery with no additional handshake required.

**refs**:
- MSG.1 (messages)
- NOTIF.1 (notifications)

---

### [WS.5] Demo WebSocket

**rules**:
- The demo WebSocket endpoint is `/api/ws/demo`.
- Connecting MUST create a temporary PTY session running a default shell.
- The session MUST be destroyed when the WebSocket disconnects.
