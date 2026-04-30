package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	ptyPkg "github.com/cookieshake/gosok-terminal/internal/pty"
)

const (
	pingInterval = 30 * time.Second
	pongTimeout  = 10 * time.Second
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type controlMessage struct {
	Type   string `json:"type"`
	Cols   uint16 `json:"cols,omitempty"`
	Rows   uint16 `json:"rows,omitempty"`
	Code   int    `json:"code,omitempty"`
	Msg    string `json:"message,omitempty"`
	Offset uint64 `json:"offset,omitempty"`
}

func bridgeSession(conn *websocket.Conn, session *ptyPkg.Session) {
	var wsMu sync.Mutex

	// Pong handler resets the read deadline each time a pong is received.
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(pingInterval + pongTimeout))
	})
	_ = conn.SetReadDeadline(time.Now().Add(pingInterval + pongTimeout))

	// Periodic ping to keep the connection alive.
	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()
	go func() {
		for range ticker.C {
			wsMu.Lock()
			err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(pongTimeout))
			wsMu.Unlock()
			if err != nil {
				return
			}
		}
	}()

	// Wait for the initial resize/hello message to learn the client's last offset.
	var clientOffset uint64
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	if msgType, data, err := conn.ReadMessage(); err == nil && msgType == websocket.TextMessage {
		var ctrl controlMessage
		if json.Unmarshal(data, &ctrl) == nil {
			clientOffset = ctrl.Offset
			if ctrl.Type == "resize" && ctrl.Cols > 0 && ctrl.Rows > 0 {
				_ = session.Resize(ctrl.Rows, ctrl.Cols)
			}
		}
	}
	_ = conn.SetReadDeadline(time.Now().Add(pingInterval + pongTimeout))

	// Subscribe to session output (multiple readers supported — broadcast to all).
	scrollData, currentOffset, fullReplay, events, canceled, sub, unsub := session.Subscribe(clientOffset)
	defer unsub()

	// Tell the client the current offset and whether this is a full replay.
	helloMsg, _ := json.Marshal(controlMessage{Type: "sync", Offset: currentOffset})
	_ = conn.WriteMessage(websocket.TextMessage, helloMsg)

	// Send scrollback delta (or full replay).
	_ = fullReplay // client decides whether to reset based on "sync" message
	if len(scrollData) > 0 {
		_ = conn.WriteMessage(websocket.BinaryMessage, scrollData)
	}

	// lastSent is the offset of the last byte we have written to the WS.
	// Every event we receive carries the offset at the END of its data, so we
	// skip events whose offset is <= lastSent (already covered by snapshot or
	// resync) and advance lastSent on every successful binary write.
	lastSent := currentOffset

	// Session output -> WebSocket
	quit := make(chan struct{}) // closed when WS read loop exits
	done := make(chan struct{}) // closed when writer goroutine exits
	go func() {
		defer close(done)
		for {
			select {
			case ev, ok := <-events:
				if !ok {
					return
				}
				if ev.Data == nil {
					// Process exited
					exitMsg, _ := json.Marshal(controlMessage{Type: "exit", Code: ev.ExitCode})
					wsMu.Lock()
					_ = conn.WriteMessage(websocket.TextMessage, exitMsg)
					wsMu.Unlock()
					return
				}

				// If the channel overflowed, fast-forward from scrollback.
				// Resync captures everything up to the latest write under the
				// dispatch lock, so the just-popped ev is guaranteed to be
				// covered (its offset <= resyncOffset) and is safely dropped.
				if sub.HasDropped() {
					resyncData, resyncOffset := session.Resync(sub, lastSent)
					syncMsg, _ := json.Marshal(controlMessage{Type: "sync", Offset: resyncOffset})
					wsMu.Lock()
					_ = conn.WriteMessage(websocket.TextMessage, syncMsg)
					if len(resyncData) > 0 {
						_ = conn.WriteMessage(websocket.BinaryMessage, resyncData)
					}
					wsMu.Unlock()
					lastSent = resyncOffset
					continue
				}

				if ev.Offset <= lastSent {
					continue
				}

				wsMu.Lock()
				err := conn.WriteMessage(websocket.BinaryMessage, ev.Data)
				wsMu.Unlock()
				if err != nil {
					return
				}
				lastSent = ev.Offset
			case <-canceled:
				return
			case <-quit:
				return
			}
		}
	}()

	// WebSocket -> PTY
	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			break
		}

		switch msgType {
		case websocket.BinaryMessage:
			if len(data) > 0 {
				_, _ = session.Write(data)
			}

		case websocket.TextMessage:
			var ctrl controlMessage
			if err := json.Unmarshal(data, &ctrl); err != nil {
				continue
			}
			switch ctrl.Type {
			case "resize":
				if ctrl.Cols > 0 && ctrl.Rows > 0 {
					_ = session.Resize(ctrl.Rows, ctrl.Cols)
				}
			case "ping":
				pong, _ := json.Marshal(controlMessage{Type: "pong"})
				wsMu.Lock()
				_ = conn.WriteMessage(websocket.TextMessage, pong)
				wsMu.Unlock()
			}
		}
	}

	close(quit)
	<-done
}

// Handler connects a WebSocket to an existing PTY session.
func Handler(ptyMgr *ptyPkg.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionID := r.PathValue("sessionID")

		session, ok := ptyMgr.Get(sessionID)
		if !ok {
			http.Error(w, "session not found", http.StatusNotFound)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("websocket upgrade error: %v", err)
			return
		}
		defer conn.Close()

		bridgeSession(conn, session)
	}
}

// DemoHandler spawns a new bash session for testing.
func DemoHandler(ptyMgr *ptyPkg.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("websocket upgrade error: %v", err)
			return
		}
		defer conn.Close()

		shell := os.Getenv("SHELL")
		if shell == "" {
			shell = "/bin/sh"
		}
		session, err := ptyMgr.Create(shell, []string{"-l"}, "", nil, 24, 80)
		if err != nil {
			errMsg, _ := json.Marshal(controlMessage{Type: "error", Msg: err.Error()})
			_ = conn.WriteMessage(websocket.TextMessage, errMsg)
			return
		}
		defer func() { _ = ptyMgr.Destroy(session.ID()) }()

		bridgeSession(conn, session)
	}
}
