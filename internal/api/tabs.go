package api

import (
	"encoding/json"
	"net/http"
	"os"

	tabPkg "github.com/cookieshake/gosok-terminal/internal/tab"
	"github.com/cookieshake/gosok-terminal/internal/store"
)

type tabHandler struct {
	store  store.Store
	tabSvc *tabPkg.Service
}

type createTabReq struct {
	Name    string `json:"name"`
	TabType string `json:"tab_type"`
	Command string `json:"command"`
	Args    string `json:"args"` // JSON array string
	Env     string `json:"env"`  // JSON object string
}

type tabResponse struct {
	*store.Tab
	Status tabPkg.TabStatus `json:"status"`
}

func (h *tabHandler) listByProject(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("projectID")
	tabs, err := h.store.ListTabsByProject(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	resp := make([]tabResponse, 0, len(tabs))
	for _, t := range tabs {
		resp = append(resp, tabResponse{
			Tab:    t,
			Status: h.tabSvc.GetStatus(t.ID),
		})
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *tabHandler) create(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("projectID")

	// Verify project exists
	project, err := h.store.GetProject(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if project == nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	var req createTabReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.TabType == "" {
		writeError(w, http.StatusBadRequest, "name and tab_type are required")
		return
	}

	// Resolve command from registry if not provided
	command := req.Command
	if command == "" {
		if tabPkg.TabType(req.TabType) == tabPkg.Shell {
			// Use user's login shell
			command = os.Getenv("SHELL")
			if command == "" {
				command = "/bin/sh"
			}
		} else {
			def, ok := tabPkg.Registry[tabPkg.TabType(req.TabType)]
			if !ok {
				writeError(w, http.StatusBadRequest, "unknown tab_type: "+req.TabType)
				return
			}
			command = def.Command
		}
	}

	args := req.Args
	if args == "" {
		args = "[]"
	}
	env := req.Env
	if env == "" {
		env = "{}"
	}

	t := &store.Tab{
		ID:        newID(),
		ProjectID: projectID,
		Name:      req.Name,
		TabType:   req.TabType,
		Command:   command,
		Args:      args,
		Env:       env,
	}

	if err := h.store.CreateTab(r.Context(), t); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, tabResponse{
		Tab:    t,
		Status: h.tabSvc.GetStatus(t.ID),
	})
}

func (h *tabHandler) get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	t, err := h.store.GetTab(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if t == nil {
		writeError(w, http.StatusNotFound, "tab not found")
		return
	}

	writeJSON(w, http.StatusOK, tabResponse{
		Tab:    t,
		Status: h.tabSvc.GetStatus(t.ID),
	})
}

func (h *tabHandler) update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := h.store.GetTab(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if existing == nil {
		writeError(w, http.StatusNotFound, "tab not found")
		return
	}

	var req createTabReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.TabType != "" {
		existing.TabType = req.TabType
	}
	if req.Command != "" {
		existing.Command = req.Command
	}
	if req.Args != "" {
		existing.Args = req.Args
	}
	if req.Env != "" {
		existing.Env = req.Env
	}

	if err := h.store.UpdateTab(r.Context(), existing); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, tabResponse{
		Tab:    existing,
		Status: h.tabSvc.GetStatus(existing.ID),
	})
}

func (h *tabHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	// Stop tab if running
	_ = h.tabSvc.Stop(r.Context(), id)

	if err := h.store.DeleteTab(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *tabHandler) start(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	st, err := h.tabSvc.Start(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (h *tabHandler) stop(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.tabSvc.Stop(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	st := h.tabSvc.GetStatus(id)
	writeJSON(w, http.StatusOK, st)
}

func (h *tabHandler) restart(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	st, err := h.tabSvc.Restart(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, st)
}
