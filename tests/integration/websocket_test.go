package integration_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	wsPkg "github.com/cookieshake/gosok-terminal/internal/ws"
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

		// v2 wire format: hello must be a FrameResize binary frame so the
		// server can finish its 5s initial-read window and start the pump.
		helloFrame, err := wsPkg.EncodeFrame(wsPkg.FrameResize, map[string]uint16{"cols": 80, "rows": 24}, nil)
		require.NoError(t, err)
		require.NoError(t, conn.WriteMessage(websocket.BinaryMessage, helloFrame))

		// Drain frames until we get the server's Snapshot, then send a Ping
		// frame and expect a Pong frame back.
		deadline := time.Now().Add(10 * time.Second)
		gotSnapshot := false
		for time.Now().Before(deadline) {
			_ = conn.SetReadDeadline(deadline)
			msgType, data, err := conn.ReadMessage()
			if err != nil {
				t.Fatalf("read error: %v", err)
			}
			if msgType != websocket.BinaryMessage {
				continue
			}
			ft, _, _, derr := wsPkg.DecodeFrame(data)
			if derr != nil {
				continue
			}
			if ft == wsPkg.FrameSnapshot {
				gotSnapshot = true
				break
			}
		}
		assert.True(t, gotSnapshot, "should have received snapshot frame from server")

		// Now send application-level Ping frame
		pingFrame, err := wsPkg.EncodeFrame(wsPkg.FramePing, nil, nil)
		require.NoError(t, err)
		require.NoError(t, conn.WriteMessage(websocket.BinaryMessage, pingFrame))

		// Read frames until we see Pong (server may push Output frames first).
		pongDeadline := time.Now().Add(5 * time.Second)
		for time.Now().Before(pongDeadline) {
			_ = conn.SetReadDeadline(pongDeadline)
			msgType, data, err := conn.ReadMessage()
			if err != nil {
				t.Fatalf("failed to read frame after ping: %v", err)
			}
			if msgType != websocket.BinaryMessage {
				continue
			}
			ft, _, _, derr := wsPkg.DecodeFrame(data)
			if derr != nil {
				continue
			}
			if ft == wsPkg.FramePong {
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
		helloFrame, encErr := wsPkg.EncodeFrame(wsPkg.FrameResize, map[string]uint16{"cols": 80, "rows": 24}, nil)
		require.NoError(t, encErr)
		_ = conn.WriteMessage(websocket.BinaryMessage, helloFrame)

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
