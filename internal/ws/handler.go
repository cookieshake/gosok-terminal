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

	writeFrame := func(t FrameType, meta any, body []byte) error {
		buf, err := EncodeFrame(t, meta, body)
		if err != nil {
			return err
		}
		wsMu.Lock()
		defer wsMu.Unlock()
		return conn.WriteMessage(websocket.BinaryMessage, buf)
	}

	// Initial hello: wait up to 5s for the client's first frame, which must be
	// a resize. Anything else is ignored — Subscribe() will use the current
	// emulator dimensions.
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	if msgType, data, err := conn.ReadMessage(); err == nil && msgType == websocket.BinaryMessage {
		if t, meta, _, derr := DecodeFrame(data); derr == nil && t == FrameResize {
			var rs struct {
				Cols uint16 `json:"cols"`
				Rows uint16 `json:"rows"`
			}
			if json.Unmarshal(meta, &rs) == nil && rs.Cols > 0 && rs.Rows > 0 {
				_ = session.Resize(rs.Rows, rs.Cols)
			}
		}
	}
	_ = conn.SetReadDeadline(time.Now().Add(pingInterval + pongTimeout))

	snapshot, currentOffset, events, canceled, sub, unsub := session.Subscribe()
	defer unsub()

	if err := writeFrame(FrameSnapshot, map[string]uint64{"offset": currentOffset}, snapshot); err != nil {
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
					_ = writeFrame(FrameExit, map[string]int{"code": ev.ExitCode}, nil)
					return
				}

				if sub.HasDropped() {
					snapData, snapOff := session.Snapshot(sub)
					if err := writeFrame(FrameSnapshot, map[string]uint64{"offset": snapOff}, snapData); err != nil {
						return
					}
					lastSent = snapOff
					continue
				}

				if ev.Offset <= lastSent {
					continue
				}

				if err := writeFrame(FrameOutput, nil, ev.Data); err != nil {
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
		if msgType != websocket.BinaryMessage {
			continue
		}
		t, meta, body, derr := DecodeFrame(data)
		if derr != nil {
			continue
		}
		switch t {
		case FrameInput:
			if len(body) > 0 {
				_, _ = session.Write(body)
			}
		case FrameResize:
			var rs struct {
				Cols uint16 `json:"cols"`
				Rows uint16 `json:"rows"`
			}
			if json.Unmarshal(meta, &rs) == nil && rs.Cols > 0 && rs.Rows > 0 {
				_ = session.Resize(rs.Rows, rs.Cols)
			}
		case FramePing:
			_ = writeFrame(FramePong, nil, nil)
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
			data, _ := EncodeFrame(FrameError, map[string]string{"message": err.Error()}, nil)
			_ = conn.WriteMessage(websocket.BinaryMessage, data)
			return
		}
		defer func() { _ = ptyMgr.Destroy(session.ID()) }()

		bridgeSession(conn, session)
	}
}
