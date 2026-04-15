# 6. Runtime View

## Server Startup

```
main()
  │
  ├─ Open SQLite DB (WAL mode, foreign keys)
  ├─ Run migrations (create tables if not exist)
  ├─ Seed default settings (shortcuts)
  ├─ Start message cleanup goroutine (24h interval, 7-day retention)
  ├─ Create frontend FS
  └─ server.New() → internally:
      ├─ Initialize PTY Manager
      ├─ Initialize Event Hub
      ├─ Initialize Services (tab, messaging)
      ├─ Register REST + WS routes
      └─ Listen on :18435
```

## Tab Start Flow

```
POST /api/v1/tabs/{id}/start
  │
  ├─ Load tab from DB
  ├─ Build environment variables
  │   ├─ GOSOK_TAB_ID, GOSOK_TAB_NAME, GOSOK_PROJECT_NAME
  │   ├─ GOSOK_API_URL, GOSOK_BIN
  │   ├─ Custom env from tab definition
  │   └─ Prepend tool paths to PATH
  ├─ PTY Manager: Create session
  │   ├─ exec.Command with resolved command + args
  │   ├─ Start PTY (pty.Start)
  │   ├─ Spawn output reader goroutine
  │   │   └─ Read 32KB chunks → write to ring buffer → broadcast to subscribers
  │   └─ Spawn wait goroutine (process exit → notify subscribers with exit code)
  └─ Return TabStatus{status: "running", sessionID}
```

## Terminal WebSocket Flow

```
Client connects: /api/ws/sessions/{sessionID}/terminal
  │
  ├─ Upgrade to WebSocket
  ├─ Subscribe to PTY session
  ├─ Start write pump (client → PTY)
  │   ├─ Text message (JSON) → parse control message
  │   │   ├─ type: "resize" → PTY.Setsize(cols, rows)
  │   │   └─ type: "ping" → respond with "pong"
  │   └─ Binary message → write to PTY stdin
  ├─ Start read pump (PTY → client)
  │   ├─ Receive from subscriber channel
  │   │   ├─ OutputMessage → send as binary WebSocket frame
  │   │   └─ ExitMessage → send JSON {type: "exit", code} → close
  │   └─ Ping every 30s, close if no pong within 10s
  └─ On disconnect: unsubscribe from session
```

## Scrollback Sync Flow

```
Client connects with initial offset N
  │
  ├─ Ring buffer: BytesSince(N)
  │   ├─ If N is within buffer range → send delta bytes
  │   └─ If N is too old (overwritten) → send full buffer contents
  └─ Client receives buffered data as initial sync
```

## Message Send Flow

```
POST /api/v1/messages
  │
  ├─ Validate scope (direct | broadcast | global)
  ├─ Insert message into DB
  ├─ Publish to Event Hub
  │   ├─ scope: direct → event with to_tab_id
  │   ├─ scope: broadcast → event to all tabs
  │   └─ scope: global → event to all subscribers
  └─ Return created message
```

## Events WebSocket Flow

```
Client connects: /api/ws/events
  │
  ├─ Subscribe to Event Hub (buffered channel, 64 slots)
  ├─ Loop: receive events from hub
  │   ├─ type: "message" → send MsgPayload as JSON
  │   └─ type: "notification" → send NotifPayload as JSON
  └─ On disconnect: unsubscribe
```
