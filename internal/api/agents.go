package api

import (
	"encoding/json"
	"net/http"
	"os"

	agentPkg "github.com/cookieshake/gosok-terminal/internal/agent"
	"github.com/cookieshake/gosok-terminal/internal/store"
)

type agentHandler struct {
	store    store.Store
	agentSvc *agentPkg.Service
}

type createAgentReq struct {
	Name      string `json:"name"`
	AgentType string `json:"agent_type"`
	Command   string `json:"command"`
	Args      string `json:"args"` // JSON array string
	Env       string `json:"env"`  // JSON object string
}

type agentResponse struct {
	*store.Agent
	Status agentPkg.AgentStatus `json:"status"`
}

func (h *agentHandler) listByProject(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("projectID")
	agents, err := h.store.ListAgentsByProject(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	resp := make([]agentResponse, 0, len(agents))
	for _, a := range agents {
		resp = append(resp, agentResponse{
			Agent:  a,
			Status: h.agentSvc.GetStatus(a.ID),
		})
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *agentHandler) create(w http.ResponseWriter, r *http.Request) {
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

	var req createAgentReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.AgentType == "" {
		writeError(w, http.StatusBadRequest, "name and agent_type are required")
		return
	}

	// Resolve command from registry if not provided
	command := req.Command
	if command == "" {
		if agentPkg.AgentType(req.AgentType) == agentPkg.Shell {
			// Use user's login shell
			command = os.Getenv("SHELL")
			if command == "" {
				command = "/bin/sh"
			}
		} else {
			def, ok := agentPkg.Registry[agentPkg.AgentType(req.AgentType)]
			if !ok {
				writeError(w, http.StatusBadRequest, "unknown agent_type: "+req.AgentType)
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

	a := &store.Agent{
		ID:        newID(),
		ProjectID: projectID,
		Name:      req.Name,
		AgentType: req.AgentType,
		Command:   command,
		Args:      args,
		Env:       env,
	}

	if err := h.store.CreateAgent(r.Context(), a); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, agentResponse{
		Agent:  a,
		Status: h.agentSvc.GetStatus(a.ID),
	})
}

func (h *agentHandler) get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	a, err := h.store.GetAgent(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if a == nil {
		writeError(w, http.StatusNotFound, "agent not found")
		return
	}

	writeJSON(w, http.StatusOK, agentResponse{
		Agent:  a,
		Status: h.agentSvc.GetStatus(a.ID),
	})
}

func (h *agentHandler) update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := h.store.GetAgent(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if existing == nil {
		writeError(w, http.StatusNotFound, "agent not found")
		return
	}

	var req createAgentReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.AgentType != "" {
		existing.AgentType = req.AgentType
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

	if err := h.store.UpdateAgent(r.Context(), existing); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, agentResponse{
		Agent:  existing,
		Status: h.agentSvc.GetStatus(existing.ID),
	})
}

func (h *agentHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	// Stop agent if running
	_ = h.agentSvc.Stop(r.Context(), id)

	if err := h.store.DeleteAgent(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *agentHandler) start(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	st, err := h.agentSvc.Start(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (h *agentHandler) stop(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.agentSvc.Stop(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	st := h.agentSvc.GetStatus(id)
	writeJSON(w, http.StatusOK, st)
}

func (h *agentHandler) restart(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	st, err := h.agentSvc.Restart(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, st)
}
