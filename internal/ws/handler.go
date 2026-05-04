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

	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(pingInterval + pongTimeout))
	})
	_ = conn.SetReadDeadline(time.Now().Add(pingInterval + pongTimeout))

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

	// Initial hello: only resize fields matter. The client's previous offset
	// is no longer relevant — every subscribe sends a self-contained snapshot
	// that brings the client into sync regardless of prior state.
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	if msgType, data, err := conn.ReadMessage(); err == nil && msgType == websocket.TextMessage {
		var ctrl controlMessage
		if json.Unmarshal(data, &ctrl) == nil {
			if ctrl.Type == "resize" && ctrl.Cols > 0 && ctrl.Rows > 0 {
				_ = session.Resize(ctrl.Rows, ctrl.Cols)
			}
		}
	}
	_ = conn.SetReadDeadline(time.Now().Add(pingInterval + pongTimeout))

	snapshot, currentOffset, events, canceled, sub, unsub := session.Subscribe()
	defer unsub()

	// sendSnapshot writes the snapshot control message + binary payload as a
	// single critical section so they are not interleaved with live event
	// writes from the writer goroutine.
	sendSnapshot := func(data []byte, offset uint64) error {
		msg, _ := json.Marshal(controlMessage{Type: "snapshot", Offset: offset})
		wsMu.Lock()
		defer wsMu.Unlock()
		if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return err
		}
		return conn.WriteMessage(websocket.BinaryMessage, data)
	}

	if err := sendSnapshot(snapshot, currentOffset); err != nil {
		return
	}
	lastSent := currentOffset

	quit := make(chan struct{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			select {
			case ev, ok := <-events:
				if !ok {
					return
				}
				if ev.Data == nil {
					exitMsg, _ := json.Marshal(controlMessage{Type: "exit", Code: ev.ExitCode})
					wsMu.Lock()
					_ = conn.WriteMessage(websocket.TextMessage, exitMsg)
					wsMu.Unlock()
					return
				}

				// On overflow: send a fresh snapshot. The snapshot is taken
				// under dispatchMu so it captures everything up to and
				// including the just-popped ev (whose offset is therefore
				// covered) — safe to drop ev and continue.
				if sub.HasDropped() {
					snapData, snapOff := session.Snapshot(sub)
					if err := sendSnapshot(snapData, snapOff); err != nil {
						return
					}
					lastSent = snapOff
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
