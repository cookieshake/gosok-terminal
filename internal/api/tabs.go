package api

import (
	"encoding/json"
	"fmt"
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
		} else if req.TabType == "editor" {
			// Editor tabs don't run a command
			command = ""
		} else {
			// Look up command from ai_tools settings
			aiToolsJSON, err := h.store.GetSetting(r.Context(), "ai_tools")
			if err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
			if aiToolsJSON == "" {
				aiToolsJSON = DefaultSettings["ai_tools"]
			}
			var aiTools []struct {
				Type    string `json:"type"`
				Command string `json:"command"`
			}
			if err := json.Unmarshal([]byte(aiToolsJSON), &aiTools); err != nil {
				writeError(w, http.StatusInternalServerError, "invalid ai_tools setting")
				return
			}
			found := false
			for _, t := range aiTools {
				if t.Type == req.TabType {
					command = t.Command
					found = true
					break
				}
			}
			if !found {
				writeError(w, http.StatusBadRequest, "unknown tab_type: "+req.TabType)
				return
			}
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

func (h *tabHandler) setTitle(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.store.UpdateTabTitle(r.Context(), id, req.Title); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *tabHandler) reorder(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.store.ReorderTabs(r.Context(), req.IDs); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *tabHandler) screen(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	data, err := h.tabSvc.Scrollback(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Apply limits: ?lines=N or ?bytes=N (default: 24 lines)
	linesStr := r.URL.Query().Get("lines")
	bytesStr := r.URL.Query().Get("bytes")

	if bytesStr != "" {
		var n int
		fmt.Sscanf(bytesStr, "%d", &n)
		if n > 0 && n < len(data) {
			data = data[len(data)-n:]
		}
	} else {
		// Default: last N lines (default 24)
		maxLines := 24
		if linesStr != "" {
			fmt.Sscanf(linesStr, "%d", &maxLines)
		}
		if maxLines > 0 {
			data = lastNLines(data, maxLines)
		}
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write(data)
}

func lastNLines(data []byte, n int) []byte {
	// Count lines from the end
	count := 0
	i := len(data) - 1
	// Skip trailing newline
	if i >= 0 && data[i] == '\n' {
		i--
	}
	for ; i >= 0; i-- {
		if data[i] == '\n' {
			count++
			if count >= n {
				return data[i+1:]
			}
		}
	}
	return data
}

func (h *tabHandler) writeInput(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req struct {
		Input string `json:"input"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.tabSvc.WriteToTab(id, []byte(req.Input)); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
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
