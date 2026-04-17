package integration_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// readSyncMessage drains messages from conn until it sees a `sync` control
// message and returns the parsed fields. Binary replay messages are consumed
// so the caller can continue reading after.
func readSyncMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration) map[string]any {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		_ = conn.SetReadDeadline(deadline)
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("read error while waiting for sync: %v", err)
		}
		if msgType != websocket.TextMessage {
			continue
		}
		var msg map[string]any
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}
		if msg["type"] == "sync" {
			return msg
		}
	}
	t.Fatalf("did not receive sync within %s", timeout)
	return nil
}

// connectWithOffset opens the terminal WS, sends the initial hello with the
// requested offset, and returns the parsed sync message. Caller closes conn.
func connectWithOffset(t *testing.T, wsURL string, offset uint64) (*websocket.Conn, map[string]any) {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)
	hello := map[string]any{"type": "resize", "cols": 80, "rows": 24, "offset": offset}
	require.NoError(t, conn.WriteJSON(hello))
	sync := readSyncMessage(t, conn, 5*time.Second)
	return conn, sync
}

// readBinary reads until a single binary message is received (or timeout),
// returning its bytes.
func readBinary(t *testing.T, conn *websocket.Conn, timeout time.Duration) []byte {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		_ = conn.SetReadDeadline(deadline)
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("read error while waiting for binary: %v", err)
		}
		if msgType == websocket.BinaryMessage {
			return data
		}
	}
	t.Fatalf("did not receive binary within %s", timeout)
	return nil
}

// readFullReplay extracts a boolean fullReplay flag from a sync message,
// treating an absent field as false.
func readFullReplay(msg map[string]any) bool {
	v, ok := msg["fullReplay"]
	if !ok {
		return false
	}
	b, _ := v.(bool)
	return b
}

// TestSC_WS_8_SyncProtocol covers the `fullReplay` flag semantics added to
// prevent reset-vs-replay races: a fresh connect must be flagged as a full
// replay, while a reconnect inside scrollback must be flagged as a delta so
// the client preserves existing content instead of resetting.
func TestSC_WS_8_SyncProtocol(t *testing.T) {
	env := NewTestEnv(t)

	projResp := env.HTTP("POST", "/api/v1/projects", `{"name":"ws-sync-protocol","path":"/tmp/ws-sync-protocol"}`)
	require.Equal(t, http.StatusCreated, projResp.Status)
	projectID := projResp.ID()
	require.NotEmpty(t, projectID)

	tabResp := env.HTTP("POST", "/api/v1/projects/"+projectID+"/tabs", `{"name":"ws-sync-tab","tab_type":"shell"}`)
	require.Equal(t, http.StatusCreated, tabResp.Status)
	tabID := tabResp.ID()
	require.NotEmpty(t, tabID)

	startResp := env.HTTP("POST", "/api/v1/tabs/"+tabID+"/start")
	require.Equal(t, http.StatusOK, startResp.Status)
	sessionID := startResp.Get("session_id")
	require.NotEmpty(t, sessionID)

	wsURL := "ws" + strings.TrimPrefix(env.BaseURL(), "http") + "/api/ws/sessions/" + sessionID + "/terminal"

	// numField reads a JSON-decoded number field, returning 0 when the field
	// is absent. The server uses `omitempty` tags, so zero values are
	// serialised as missing keys rather than explicit 0s.
	numField := func(m map[string]any, key string) uint64 {
		v, ok := m[key]
		if !ok {
			return 0
		}
		f, _ := v.(float64)
		return uint64(f)
	}

	t.Run("first connect is flagged as full replay", func(t *testing.T) {
		conn, sync := connectWithOffset(t, wsURL, 0)
		defer conn.Close()

		assert.True(t, readFullReplay(sync), "initial sync must set fullReplay=true (offset=0)")
	})

	t.Run("reconnect inside scrollback is flagged as delta", func(t *testing.T) {
		// First connection: send a marker, wait for the echo, and track every
		// binary byte the server sends. The running total is exactly the offset
		// we should reconnect with.
		conn1, sync1 := connectWithOffset(t, wsURL, 0)
		observedOffset := numField(sync1, "offset")
		if numField(sync1, "replaySize") > 0 {
			b := readBinary(t, conn1, 2*time.Second)
			observedOffset += uint64(len(b))
		}

		marker := "echo __SYNC_MARKER_8__\n"
		require.NoError(t, conn1.WriteMessage(websocket.BinaryMessage, []byte(marker)))

		deadline := time.Now().Add(5 * time.Second)
		saw := false
		for time.Now().Before(deadline) && !saw {
			_ = conn1.SetReadDeadline(deadline)
			msgType, data, err := conn1.ReadMessage()
			if err != nil {
				t.Fatalf("read error waiting for echo: %v", err)
			}
			if msgType == websocket.BinaryMessage {
				observedOffset += uint64(len(data))
				if strings.Contains(string(data), "__SYNC_MARKER_8__") {
					saw = true
				}
			}
		}
		require.True(t, saw, "expected PTY to echo marker before reconnect")
		require.Greater(t, observedOffset, uint64(0), "test precondition: first connection must have consumed some output")
		_ = conn1.Close()

		// Second connection: reconnect from the observed offset. The output is
		// still inside the 1 MiB ring buffer, so the server MUST send a delta
		// (fullReplay=false) rather than a full-buffer reset.
		conn2, sync2 := connectWithOffset(t, wsURL, observedOffset)
		defer conn2.Close()

		assert.False(t, readFullReplay(sync2), "in-range reconnect must set fullReplay=false (was: %v)", sync2["fullReplay"])
	})
}

func TestSC_WS_3_Keepalive(t *testing.T) {
	env := NewTestEnv(t)

	// Create project and tab via HTTP
	projResp := env.HTTP("POST", "/api/v1/projects", `{"name":"ws-keepalive-project","path":"/tmp/ws-keepalive"}`)
	require.Equal(t, http.StatusCreated, projResp.Status)
	projectID := projResp.ID()
	require.NotEmpty(t, projectID)

	tabResp := env.HTTP("POST", "/api/v1/projects/"+projectID+"/tabs", `{"name":"ws-keepalive-tab","tab_type":"shell"}`)
	require.Equal(t, http.StatusCreated, tabResp.Status)
	tabID := tabResp.ID()
	require.NotEmpty(t, tabID)

	// Start tab
	startResp := env.HTTP("POST", "/api/v1/tabs/"+tabID+"/start")
	require.Equal(t, http.StatusOK, startResp.Status)
	sessionID := startResp.Get("session_id")
	require.NotEmpty(t, sessionID, "start response should contain session_id")

	wsURL := "ws" + strings.TrimPrefix(env.BaseURL(), "http") + "/api/ws/sessions/" + sessionID + "/terminal"

	t.Run("ping pong exchange", func(t *testing.T) {
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		require.NoError(t, err)
		defer conn.Close()

		// The server reads up to one initial message with a 5s deadline.
		// Send a resize/hello so server can proceed immediately.
		hello := map[string]any{"type": "resize", "cols": 80, "rows": 24, "offset": 0}
		err = conn.WriteJSON(hello)
		require.NoError(t, err)

		// Drain messages until we get the server's "sync" control message,
		// then send a ping and expect a pong.
		deadline := time.Now().Add(10 * time.Second)
		gotSync := false
		for time.Now().Before(deadline) {
			_ = conn.SetReadDeadline(deadline)
			msgType, data, err := conn.ReadMessage()
			if err != nil {
				t.Fatalf("read error: %v", err)
			}
			if msgType != websocket.TextMessage {
				continue
			}
			var msg map[string]any
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}
			if msg["type"] == "sync" {
				gotSync = true
				break
			}
		}
		assert.True(t, gotSync, "should have received sync message from server")

		// Now send application-level ping
		ping := map[string]string{"type": "ping"}
		err = conn.WriteJSON(ping)
		require.NoError(t, err)

		// Read until we get pong
		pongDeadline := time.Now().Add(5 * time.Second)
		for time.Now().Before(pongDeadline) {
			_ = conn.SetReadDeadline(pongDeadline)
			msgType, data, err := conn.ReadMessage()
			if err != nil {
				t.Fatalf("failed to read message after ping: %v", err)
			}
			if msgType != websocket.TextMessage {
				continue
			}
			var msg map[string]string
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}
			if msg["type"] == "pong" {
				return // success
			}
		}
		t.Fatal("did not receive pong response to ping within timeout")
	})

	t.Run("server sends ping within 30s", func(t *testing.T) {
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		require.NoError(t, err)
		defer conn.Close()

		// Send initial hello so server doesn't wait 5s for the first message.
		hello := map[string]any{"type": "resize", "cols": 80, "rows": 24, "offset": 0}
		conn.WriteJSON(hello) //nolint:errcheck

		gotPing := make(chan struct{}, 1)
		conn.SetPingHandler(func(appData string) error {
			// Send pong in response (required by WebSocket protocol)
			_ = conn.WriteControl(websocket.PongMessage, []byte(appData), time.Now().Add(5*time.Second))
			select {
			case gotPing <- struct{}{}:
			default:
			}
			return nil
		})

		// Read pump to allow the ping handler to fire
		go func() {
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					return
				}
			}
		}()

		select {
		case <-gotPing:
			// Success: server sent a WebSocket-level ping within expected window
		case <-time.After(35 * time.Second):
			t.Fatal("server did not send a WebSocket ping within 35 seconds")
		}
	})
}
