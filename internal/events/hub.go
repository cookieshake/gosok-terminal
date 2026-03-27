package events

import (
	"encoding/json"
	"sync"
	"time"
)

type EventType string

const (
	EventMessage      EventType = "message"
	EventNotification EventType = "notification"
)

type Event struct {
	Type         EventType    `json:"type"`
	Message      *MsgPayload  `json:"message,omitempty"`
	Notification *NotifPayload `json:"notification,omitempty"`
}

type MsgPayload struct {
	ID        string `json:"id"`
	Scope     string `json:"scope"`
	FromTabID string `json:"from_tab_id"`
	ToTabID   string `json:"to_tab_id,omitempty"`
	Body      string `json:"body"`
	CreatedAt string `json:"created_at"`
}

type NotifPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	TabID string `json:"tab_id,omitempty"`
}

func (e Event) JSON() []byte {
	b, _ := json.Marshal(e)
	return b
}

type Hub struct {
	mu          sync.RWMutex
	subscribers map[chan Event]struct{}
}

func NewHub() *Hub {
	return &Hub{
		subscribers: make(map[chan Event]struct{}),
	}
}

func (h *Hub) Subscribe() (<-chan Event, func()) {
	ch := make(chan Event, 64)
	h.mu.Lock()
	h.subscribers[ch] = struct{}{}
	h.mu.Unlock()

	unsub := func() {
		h.mu.Lock()
		delete(h.subscribers, ch)
		h.mu.Unlock()
		close(ch)
	}
	return ch, unsub
}

func (h *Hub) Publish(e Event) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for ch := range h.subscribers {
		select {
		case ch <- e:
		default:
			// drop if subscriber is slow
		}
	}
}

func (h *Hub) PublishMessage(id, scope, fromTabID, toTabID, body string, createdAt time.Time) {
	h.Publish(Event{
		Type: EventMessage,
		Message: &MsgPayload{
			ID:        id,
			Scope:     scope,
			FromTabID: fromTabID,
			ToTabID:   toTabID,
			Body:      body,
			CreatedAt: createdAt.Format(time.RFC3339),
		},
	})
}

func (h *Hub) PublishNotification(title, body, tabID string) {
	h.Publish(Event{
		Type: EventNotification,
		Notification: &NotifPayload{
			Title: title,
			Body:  body,
			TabID: tabID,
		},
	})
}
