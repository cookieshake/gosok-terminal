package ws

import (
	"net/http"
	"time"

	"github.com/gorilla/websocket"

	"github.com/cookieshake/gosok-terminal/internal/events"
)

func EventsHandler(hub *events.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		ch, unsub := hub.Subscribe()
		defer unsub()

		// Read pump: discard incoming messages, detect close.
		done := make(chan struct{})
		go func() {
			defer close(done)
			conn.SetReadDeadline(time.Now().Add(pingInterval + pongTimeout))
			conn.SetPongHandler(func(string) error {
				return conn.SetReadDeadline(time.Now().Add(pingInterval + pongTimeout))
			})
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					return
				}
			}
		}()

		// Ping ticker
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()

		for {
			select {
			case evt, ok := <-ch:
				if !ok {
					return
				}
				conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if err := conn.WriteMessage(websocket.TextMessage, evt.JSON()); err != nil {
					return
				}
			case <-ticker.C:
				conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			case <-done:
				return
			}
		}
	}
}
