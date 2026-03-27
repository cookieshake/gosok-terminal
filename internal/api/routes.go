package api

import (
	"net/http"

	"github.com/cookieshake/gosok-terminal/internal/events"
	"github.com/cookieshake/gosok-terminal/internal/store"
	"github.com/cookieshake/gosok-terminal/internal/tab"
)

func Register(mux *http.ServeMux, s store.Store, tabSvc *tab.Service, hub *events.Hub) {
	ph := &projectHandler{store: s}
	th := &tabHandler{store: s, tabSvc: tabSvc}

	// Projects
	mux.HandleFunc("GET /api/v1/projects", ph.list)
	mux.HandleFunc("POST /api/v1/projects", ph.create)
	mux.HandleFunc("GET /api/v1/projects/{id}", ph.get)
	mux.HandleFunc("PUT /api/v1/projects/{id}", ph.update)
	mux.HandleFunc("DELETE /api/v1/projects/{id}", ph.delete)
	mux.HandleFunc("PUT /api/v1/projects/reorder", ph.reorder)

	// Tabs
	mux.HandleFunc("GET /api/v1/projects/{projectID}/tabs", th.listByProject)
	mux.HandleFunc("POST /api/v1/projects/{projectID}/tabs", th.create)
	mux.HandleFunc("GET /api/v1/tabs/{id}", th.get)
	mux.HandleFunc("PUT /api/v1/tabs/{id}", th.update)
	mux.HandleFunc("DELETE /api/v1/tabs/{id}", th.delete)

	// Tab lifecycle
	mux.HandleFunc("POST /api/v1/tabs/{id}/start", th.start)
	mux.HandleFunc("POST /api/v1/tabs/{id}/stop", th.stop)
	mux.HandleFunc("POST /api/v1/tabs/{id}/restart", th.restart)
	mux.HandleFunc("PUT /api/v1/tabs/{id}/title", th.setTitle)
	mux.HandleFunc("PUT /api/v1/tabs/reorder", th.reorder)

	// Settings
	sh := &settingsHandler{store: s}
	mux.HandleFunc("GET /api/v1/settings", sh.list)
	mux.HandleFunc("GET /api/v1/settings/{key}", sh.get)
	mux.HandleFunc("PUT /api/v1/settings/{key}", sh.set)
	mux.HandleFunc("DELETE /api/v1/settings/{key}", sh.reset)

	// Diff
	dh := &diffHandler{store: s}
	mux.HandleFunc("GET /api/v1/projects/{id}/diff", dh.list)
	mux.HandleFunc("GET /api/v1/projects/{id}/diff/file", dh.file)

	// Filesystem
	mux.HandleFunc("GET /api/v1/fs/dirs", listDirs)
	mux.HandleFunc("GET /api/v1/fs/files", listFiles)
	mux.HandleFunc("GET /api/v1/fs/file", readFile)
	mux.HandleFunc("PUT /api/v1/fs/file", writeFile)

	// Messages
	mh := &messageHandler{store: s, hub: hub}
	mux.HandleFunc("POST /api/v1/messages", mh.create)
	mux.HandleFunc("GET /api/v1/messages/inbox/{tabID}", mh.inbox)
	mux.HandleFunc("GET /api/v1/messages/feed", mh.feed)
	mux.HandleFunc("PUT /api/v1/messages/inbox/{tabID}/read", mh.markInboxRead)
	mux.HandleFunc("PUT /api/v1/messages/feed/read/{tabID}", mh.markFeedRead)

	// Notifications
	nh := &notifyHandler{hub: hub}
	mux.HandleFunc("POST /api/v1/notify", nh.send)
}
