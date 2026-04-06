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
			conn.SetReadDeadline(deadline)
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
			conn.SetReadDeadline(pongDeadline)
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
			conn.WriteControl(websocket.PongMessage, []byte(appData), time.Now().Add(5*time.Second))
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
