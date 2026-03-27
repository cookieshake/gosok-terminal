package api

import (
	"encoding/json"
	"net/http"

	"github.com/cookieshake/gosok-terminal/internal/events"
)

type notifyHandler struct {
	hub *events.Hub
}

func (h *notifyHandler) send(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title string `json:"title"`
		Body  string `json:"body"`
		TabID string `json:"tab_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	h.hub.PublishNotification(req.Title, req.Body, req.TabID)
	w.WriteHeader(http.StatusNoContent)
}
