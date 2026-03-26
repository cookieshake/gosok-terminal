package ws

import (
	"encoding/json"
	"errors"
	"io"
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
	Type string `json:"type"`
	Cols uint16 `json:"cols,omitempty"`
	Rows uint16 `json:"rows,omitempty"`
	Code int    `json:"code,omitempty"`
	Msg  string `json:"message,omitempty"`
}

func bridgeSession(conn *websocket.Conn, session *ptyPkg.Session) {
	// Mutex to protect concurrent WebSocket writes
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

	// Replay scrollback buffer so the client sees previous output.
	if data := session.Scrollback(); len(data) > 0 {
		_ = conn.WriteMessage(websocket.BinaryMessage, data)
	}

	// PTY -> WebSocket
	done := make(chan struct{})
	go func() {
		defer close(done)
		buf := make([]byte, 32*1024)
		for {
			n, err := session.Read(buf)
			if n > 0 {
				wsMu.Lock()
				writeErr := conn.WriteMessage(websocket.BinaryMessage, buf[:n])
				wsMu.Unlock()
				if writeErr != nil {
					return
				}
			}
			if err != nil {
				if err != io.EOF && !errors.Is(err, os.ErrClosed) {
					log.Printf("pty read error: %v", err)
				}
				exitMsg, _ := json.Marshal(controlMessage{Type: "exit", Code: session.ExitCode()})
				wsMu.Lock()
				_ = conn.WriteMessage(websocket.TextMessage, exitMsg)
				wsMu.Unlock()
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
			if ctrl.Type == "resize" && ctrl.Cols > 0 && ctrl.Rows > 0 {
				_ = session.Resize(ctrl.Rows, ctrl.Cols)
			}
		}
	}

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
		defer ptyMgr.Destroy(session.ID())

		bridgeSession(conn, session)
	}
}
