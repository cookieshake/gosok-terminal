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
| fullReplay | boolean | - | True when the replay is the full buffer and the client MUST reset before displaying it; false (or absent) for an incremental delta (sync only) |

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
- Scrollback sync happens at connection time and whenever the server detects the client has fallen behind.
- The client MUST include its current byte offset in the hello message when connecting.
- The server MUST send a `sync` control message to the client immediately after subscribing, containing the authoritative current offset and the byte length of replay data that follows (`replaySize`).
- If there is replay data, the server MUST send it as a single binary message immediately after the `sync` message.
- If the requested offset has been overwritten (older than buffer capacity), the server MUST send the full buffer contents as the replay data and set `fullReplay: true` in the sync message.
- If the requested offset is within the buffer, the server MUST send only the delta since that offset and set `fullReplay: false` (or omit the field); the client MUST append the delta without resetting.
- When events are dropped (subscriber channel full), the server MUST NOT send the stale in-flight event, and MUST resync the client by sending a `sync` with `fullReplay: true` followed by the full buffer as replay.
- When `fullReplay: true`, the client MUST clear the terminal and display the replay cleanly, with no previous-session content visible or mixed in.

**refs**:
- TERM.2 (ring buffer, BytesSince)
- TERM.3 (subscriber, dropped events)

---

### [WS.3.1] Terminal WebSocket Liveness and Reconnect

**rules**:
- The terminal WebSocket client MUST run an application-level heartbeat on an interval of at most 15 seconds while the socket is open, sending a `ping` control message each tick.
- The client MUST track the timestamp of the most recent message received from the server (binary or text).
- If no message has been received for 45 seconds while the socket's `readyState` is still `OPEN`, the client MUST treat the connection as dead and MUST call `close()` on the socket so the normal `onclose` reconnect path runs. Setting a UI "dead connection" flag alone is NOT sufficient.
- When `document.visibilityState` transitions to `visible`, the client MUST check the terminal socket. If the socket is not `OPEN`, or if the last received message is older than the heartbeat silence threshold, the client MUST force a reconnect and MUST reset the exponential backoff delay to its initial value (1 second).
- On automatic reconnect via the `onclose` path, the client MUST use exponential backoff starting at 1 second and capping at 30 seconds, matching [WS.4].

**notes**:
On mobile, the OS may silently drop a TCP connection while the browser tab is backgrounded. The WebSocket then becomes half-open: `readyState` stays `OPEN` but no frames flow and `onclose` may not fire until the browser next tries to write. Without an explicit liveness check on visibility return, the user sees the terminal appear frozen and the "Connection lost. Reconnecting…" banner never clears. The heartbeat-triggered `close()` and the visibility-triggered forced reconnect together guarantee the half-open state is resolved promptly.

**refs**:
- WS.1 (terminal protocol)
- WS.2 (server-side keepalive)
- WS.4 (events WebSocket reconnect, shared backoff policy)

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
