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

type debugResponse struct {
	GeneratedAt string         `json:"generated_at"`
	Server      debugServer    `json:"server"`
	Tab         *store.Tab     `json:"tab"`
	Status      tabPkg.TabStatus `json:"status"`
	Session     any            `json:"session,omitempty"`
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

	resp := debugResponse{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339Nano),
		Server: debugServer{
			GoVersion: runtime.Version(),
			GOOS:      runtime.GOOS,
			GOARCH:    runtime.GOARCH,
		},
		Tab:    tab,
		Status: h.tabSvc.GetStatus(id),
	}

	if session := h.tabSvc.Session(id); session != nil {
		info := session.DebugInfo()
		resp.Session = info
	}

	writeJSON(w, http.StatusOK, resp)
}
