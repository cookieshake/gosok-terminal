package api

import (
	"net/http"

	"github.com/cookieshake/gosok-terminal/internal/agent"
	"github.com/cookieshake/gosok-terminal/internal/store"
)

func Register(mux *http.ServeMux, s store.Store, agentSvc *agent.Service) {
	ph := &projectHandler{store: s}
	ah := &agentHandler{store: s, agentSvc: agentSvc}

	// Projects
	mux.HandleFunc("GET /api/v1/projects", ph.list)
	mux.HandleFunc("POST /api/v1/projects", ph.create)
	mux.HandleFunc("GET /api/v1/projects/{id}", ph.get)
	mux.HandleFunc("PUT /api/v1/projects/{id}", ph.update)
	mux.HandleFunc("DELETE /api/v1/projects/{id}", ph.delete)

	// Agents
	mux.HandleFunc("GET /api/v1/projects/{projectID}/agents", ah.listByProject)
	mux.HandleFunc("POST /api/v1/projects/{projectID}/agents", ah.create)
	mux.HandleFunc("GET /api/v1/agents/{id}", ah.get)
	mux.HandleFunc("PUT /api/v1/agents/{id}", ah.update)
	mux.HandleFunc("DELETE /api/v1/agents/{id}", ah.delete)

	// Agent lifecycle
	mux.HandleFunc("POST /api/v1/agents/{id}/start", ah.start)
	mux.HandleFunc("POST /api/v1/agents/{id}/stop", ah.stop)
	mux.HandleFunc("POST /api/v1/agents/{id}/restart", ah.restart)
}
