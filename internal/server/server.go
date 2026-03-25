package server

import (
	"encoding/json"
	"io/fs"
	"net/http"

	"github.com/cookieshake/gosok-terminal/internal/api"
	ptyPkg "github.com/cookieshake/gosok-terminal/internal/pty"
	"github.com/cookieshake/gosok-terminal/internal/store"
	tabPkg "github.com/cookieshake/gosok-terminal/internal/tab"
	"github.com/cookieshake/gosok-terminal/internal/ws"
)

type Server struct {
	mux    *http.ServeMux
	PtyMgr *ptyPkg.Manager
	TabSvc *tabPkg.Service
	Store  store.Store
}

func New(s store.Store, frontendFS ...fs.FS) *Server {
	ptyMgr := ptyPkg.NewManager()
	tabSvc := tabPkg.NewService(s, ptyMgr)
	mux := http.NewServeMux()

	srv := &Server{
		mux:    mux,
		PtyMgr: ptyMgr,
		TabSvc: tabSvc,
		Store:  s,
	}

	// Health check
	mux.HandleFunc("GET /api/v1/health", handleHealth)

	// REST API
	api.Register(mux, s, tabSvc)

	// WebSocket: demo terminal (spawns bash)
	mux.HandleFunc("GET /api/ws/demo", ws.DemoHandler(ptyMgr))

	// WebSocket: connect to existing PTY session
	mux.HandleFunc("GET /api/ws/sessions/{sessionID}/terminal", ws.Handler(ptyMgr))

	// Serve embedded frontend if provided
	if len(frontendFS) > 0 && frontendFS[0] != nil {
		mux.Handle("/", ServeFrontend(frontendFS[0]))
	}

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
