package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/cookieshake/gosok-terminal/internal/events"
	"github.com/cookieshake/gosok-terminal/internal/store"
)

type messageHandler struct {
	store store.Store
	hub   *events.Hub
}

func (h *messageHandler) create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Scope     string `json:"scope"`
		FromTabID string `json:"from_tab_id"`
		ToTabID   string `json:"to_tab_id"`
		Body      string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	switch req.Scope {
	case "direct":
		if req.ToTabID == "" {
			writeError(w, http.StatusBadRequest, "to_tab_id required for direct messages")
			return
		}
	case "broadcast", "global":
		// ok
	default:
		writeError(w, http.StatusBadRequest, "scope must be direct, broadcast, or global")
		return
	}

	if req.Body == "" {
		writeError(w, http.StatusBadRequest, "body is required")
		return
	}

	m := &store.Message{
		ID:        newID(),
		Scope:     req.Scope,
		FromTabID: req.FromTabID,
		ToTabID:   req.ToTabID,
		Body:      req.Body,
	}

	if err := h.store.CreateMessage(r.Context(), m); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create message")
		return
	}

	h.hub.PublishMessage(m.ID, m.Scope, m.FromTabID, m.ToTabID, m.Body, m.CreatedAt)
	writeJSON(w, http.StatusCreated, m)
}

func (h *messageHandler) inbox(w http.ResponseWriter, r *http.Request) {
	tabID := r.PathValue("tabID")
	since := r.URL.Query().Get("since")

	msgs, err := h.store.GetInbox(r.Context(), tabID, since)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get inbox")
		return
	}
	if msgs == nil {
		msgs = []*store.Message{}
	}
	writeJSON(w, http.StatusOK, msgs)
}

func (h *messageHandler) feed(w http.ResponseWriter, r *http.Request) {
	since := r.URL.Query().Get("since")

	msgs, err := h.store.GetFeed(r.Context(), since)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get feed")
		return
	}
	if msgs == nil {
		msgs = []*store.Message{}
	}
	writeJSON(w, http.StatusOK, msgs)
}

func (h *messageHandler) markInboxRead(w http.ResponseWriter, r *http.Request) {
	tabID := r.PathValue("tabID")
	var req struct {
		LastReadID string `json:"last_read_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.LastReadID == "" {
		writeError(w, http.StatusBadRequest, "last_read_id is required")
		return
	}

	if err := h.store.UpdateReadMarker(r.Context(), tabID, "inbox", req.LastReadID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update read marker")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *messageHandler) waitInbox(w http.ResponseWriter, r *http.Request) {
	tabID := r.PathValue("tabID")
	timeoutStr := r.URL.Query().Get("timeout")
	timeout := 30 * time.Second
	if timeoutStr != "" {
		if d, err := time.ParseDuration(timeoutStr); err == nil && d > 0 {
			if d > 5*time.Minute {
				d = 5 * time.Minute
			}
			timeout = d
		}
	}

	// Subscribe to hub for real-time events
	ch, unsub := h.hub.Subscribe()
	defer unsub()

	ctx := r.Context()
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	for {
		select {
		case evt, ok := <-ch:
			if !ok {
				writeJSON(w, http.StatusOK, []*store.Message{})
				return
			}
			if evt.Type != events.EventMessage || evt.Message == nil {
				continue
			}
			msg := evt.Message
			// Check if this message is for our tab
			if (msg.Scope == "direct" && msg.ToTabID == tabID) || msg.Scope == "broadcast" {
				writeJSON(w, http.StatusOK, []any{msg})
				return
			}
		case <-timer.C:
			writeJSON(w, http.StatusOK, []*store.Message{})
			return
		case <-ctx.Done():
			return
		}
	}
}

func (h *messageHandler) markFeedRead(w http.ResponseWriter, r *http.Request) {
	tabID := r.PathValue("tabID")
	var req struct {
		LastReadID string `json:"last_read_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.LastReadID == "" {
		writeError(w, http.StatusBadRequest, "last_read_id is required")
		return
	}

	if err := h.store.UpdateReadMarker(r.Context(), tabID, "feed", req.LastReadID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update read marker")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
