package server

import (
	"encoding/json"
	"net/http"

	agentPkg "github.com/cookieshake/gosok-terminal/internal/agent"
	"github.com/cookieshake/gosok-terminal/internal/api"
	ptyPkg "github.com/cookieshake/gosok-terminal/internal/pty"
	"github.com/cookieshake/gosok-terminal/internal/store"
	"github.com/cookieshake/gosok-terminal/internal/ws"
)

type Server struct {
	mux      *http.ServeMux
	PtyMgr   *ptyPkg.Manager
	AgentSvc *agentPkg.Service
	Store    store.Store
}

func New(s store.Store) *Server {
	ptyMgr := ptyPkg.NewManager()
	agentSvc := agentPkg.NewService(s, ptyMgr)
	mux := http.NewServeMux()

	srv := &Server{
		mux:      mux,
		PtyMgr:   ptyMgr,
		AgentSvc: agentSvc,
		Store:    s,
	}

	// Health check
	mux.HandleFunc("GET /api/v1/health", handleHealth)

	// REST API
	api.Register(mux, s, agentSvc)

	// WebSocket: demo terminal (spawns bash)
	mux.HandleFunc("GET /api/ws/demo", ws.DemoHandler(ptyMgr))

	// WebSocket: connect to existing PTY session
	mux.HandleFunc("GET /api/ws/sessions/{sessionID}/terminal", ws.Handler(ptyMgr))

	// CORS middleware for development
	return srv
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Simple CORS for development
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	s.mux.ServeHTTP(w, r)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}
