# Connection Scenarios

### [SC.WS.1] Terminal Connection

**scenarios**:

#### User opens a terminal tab and can type and see output

- **Given** A tab exists with a running session
- **When** The user opens the tab in the Web UI
- **Then** The terminal loads, displays any existing output, and the user can type commands and see responses

#### User closes a terminal tab

- **Given** The user has a terminal tab open
- **When** The user navigates away or closes the tab
- **Then** The terminal view is cleaned up without affecting the running session

#### User opens a tab with no running session

- **Given** A tab exists but its session has not been started
- **When** The user opens the tab
- **Then** The terminal indicates that no session is active and does not accept input

**refs**:
- WS.1

---

### [SC.WS.2] Terminal Events

**scenarios**:

#### User resizes the window

- **Given** A terminal tab is open with a running session
- **When** The user resizes the browser window or terminal pane
- **Then** The terminal content reflows to fit the new dimensions

#### Process exits and user sees notification

- **Given** A terminal tab is open with a running command
- **When** The command finishes or crashes
- **Then** The user sees an indication that the process has exited, along with the exit status

#### Terminal stays responsive during idle periods

- **Given** A terminal tab is open with a running session
- **When** The user leaves the terminal idle for several minutes without typing
- **Then** The terminal remains connected and responsive when the user returns to type

**refs**:
- WS.1, WS.3

---

### [SC.WS.3] Connection Keepalive

**scenarios**:

#### Terminal stays connected during inactivity

- **Given** A terminal tab is open
- **When** No user interaction occurs for an extended period
- **Then** The connection remains alive and the terminal responds immediately when the user types again

#### Terminal disconnects if network drops

- **Given** A terminal tab is open
- **When** The user's network connection is lost for a prolonged period
- **Then** The terminal indicates that the connection has been lost

**refs**:
- WS.2

---

### [SC.WS.3.1] Terminal Reconnect After Mobile Background

**scenarios**:

#### Mobile user returns after long background and terminal reconnects

- **Given** A terminal tab is open on mobile and the user backgrounds the browser for long enough that the OS silently drops the underlying TCP connection, leaving the WebSocket half-open
- **When** The user brings the browser back to the foreground
- **Then** The client detects that the socket is no longer delivering messages, closes it, reconnects the terminal WebSocket, and resumes receiving PTY output without the user having to refresh the page

#### Heartbeat silence forces reconnect even while foregrounded

- **Given** A terminal tab is open and the socket's `readyState` is still `OPEN` but no data has been received for more than 45 seconds because the network path is dead
- **When** The heartbeat interval fires
- **Then** The client closes the stale socket and the standard reconnect path re-establishes the connection

#### Force reconnect on an open socket creates exactly one new connection

- **Given** A terminal tab is open with an active WebSocket connection
- **When** A force-reconnect is triggered (e.g., visibility return with a stale open socket) while the socket is still `OPEN`
- **Then** Exactly one new WebSocket connection is established; the `onclose` handler of the force-closed socket does NOT schedule a second connection

**refs**:
- WS.3.1

---

### [SC.WS.4] Scrollback on Reconnect

**scenarios**:

#### User refreshes the page and sees previous output

- **Given** A tab has a running session that has produced output
- **When** The user refreshes the browser page
- **Then** The terminal reloads and displays all previous output so the user does not lose context

#### User reconnects after extensive output

- **Given** A tab has produced more output than can be stored in scrollback
- **When** The user reconnects to the terminal
- **Then** The terminal displays as much recent output as possible, and the user can continue working from the current state

**refs**:
- WS.3, TERM.2

---

### [SC.WS.8] Sync Protocol — Full vs Delta Replay

**scenarios**:

#### First-time connect receives a full replay flagged as such

- **Given** A client connects to a terminal session for the first time (offset 0)
- **When** The server sends its initial `sync` control message
- **Then** The message has `fullReplay: true` so the client knows to reset before displaying the replay

#### Reconnect within scrollback receives an incremental delta

- **Given** A client has previously been connected and reconnects with a valid offset that is still within the ring buffer
- **When** The server sends the `sync` control message
- **Then** The message has `fullReplay: false` (or omitted) and the client MUST append the delta without clearing existing content

**refs**:
- WS.3

---

### [SC.WS.5] Real-Time Events

**scenarios**:

#### User sees a message notification appear

- **Given** The user has the Web UI open
- **When** A notification event is triggered (e.g., a process completes in another tab)
- **Then** The user sees the notification appear in the UI without needing to refresh

#### User sees multiple notifications

- **Given** The user has the Web UI open
- **When** Several notification events arrive in quick succession
- **Then** All notifications are displayed to the user in order

**refs**:
- WS.4

---

### [SC.WS.6] Demo Terminal

**scenarios**:

#### User tries demo without creating a project

- **Given** The user opens the gosok demo page without any existing projects
- **When** The demo terminal loads
- **Then** The user sees a working terminal session where they can type commands and see output

#### User leaves the demo

- **Given** The user is using the demo terminal
- **When** The user closes the demo page or navigates away
- **Then** The temporary demo session is cleaned up automatically

**refs**:
- WS.5

---

### [SC.WS.7] Events WebSocket Reconnect

**scenarios**:

#### Notifications resume after a network interruption

- **Given** The user has the Web UI open and has been receiving notifications
- **When** The network drops and reconnects
- **Then** The events WebSocket reconnects automatically and new notifications are delivered without requiring a page refresh

#### Reconnect delay backs off on repeated failures

- **Given** The events WebSocket cannot connect (e.g., server is down)
- **When** Multiple reconnect attempts fail in succession
- **Then** The client waits progressively longer between attempts (up to 30 seconds) without flooding the server

**refs**:
- WS.4
