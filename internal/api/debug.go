package api

import (
	"net/http"
	"runtime"
	"time"

	tabPkg "github.com/cookieshake/gosok-terminal/internal/tab"
	"github.com/cookieshake/gosok-terminal/internal/store"
)

type debugHandler struct {
	store  store.Store
	tabSvc *tabPkg.Service
}

// tabView is the subset of store.Tab safe to ship in a debug bundle.
// store.Tab.Env is intentionally omitted — users put credentials there.
type tabView struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	Name      string `json:"name"`
	Title     string `json:"title"`
	Command   string `json:"command"`
	Args      string `json:"args"`
}

type debugResponse struct {
	GeneratedAt string           `json:"generated_at"`
	Server      debugServer      `json:"server"`
	Tab         tabView          `json:"tab"`
	Status      tabPkg.TabStatus `json:"status"`
	Session     any              `json:"session,omitempty"`
}

type debugServer struct {
	GoVersion string `json:"go_version"`
	GOOS      string `json:"goos"`
	GOARCH    string `json:"goarch"`
}

func (h *debugHandler) get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	tab, err := h.store.GetTab(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tab == nil {
		writeError(w, http.StatusNotFound, "tab not found")
		return
	}

	status := h.tabSvc.GetStatus(id)
	resp := debugResponse{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339Nano),
		Server: debugServer{
			GoVersion: runtime.Version(),
			GOOS:      runtime.GOOS,
			GOARCH:    runtime.GOARCH,
		},
		Tab: tabView{
			ID: tab.ID, ProjectID: tab.ProjectID, Name: tab.Name,
			Title: tab.Title, Command: tab.Command, Args: tab.Args,
		},
		Status: status,
	}

	// Only attach session state when the tab is actually running — avoids
	// reporting stale emulator state from a tab whose readLoop has unwound.
	if status.Status == tabPkg.StatusRunning {
		if session := h.tabSvc.Session(id); session != nil {
			resp.Session = session.DebugInfo()
		}
	}

	writeJSON(w, http.StatusOK, resp)
}
