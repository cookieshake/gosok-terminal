package api

import (
	"net/http"
	"os/exec"
	"strings"

	"github.com/cookieshake/gosok-terminal/internal/store"
)

type diffHandler struct {
	store store.Store
}

type diffFile struct {
	Path   string `json:"path"`
	Status string `json:"status"`
}

// GET /api/v1/projects/{id}/diff?staged=true — list changed files
func (h *diffHandler) list(w http.ResponseWriter, r *http.Request) {
	p, err := h.getProject(r)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	staged := r.URL.Query().Get("staged") == "true"
	args := []string{"diff", "--name-status"}
	if staged {
		args = append(args, "--staged")
	}

	cmd := exec.CommandContext(r.Context(), "git", args...)
	cmd.Dir = p.Path
	out, _ := cmd.Output()

	var files []diffFile
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		files = append(files, diffFile{Status: parts[0], Path: parts[len(parts)-1]})
	}
	if files == nil {
		files = []diffFile{}
	}
	writeJSON(w, http.StatusOK, files)
}

// GET /api/v1/projects/{id}/diff/file?path=...&staged=true — original + modified content
func (h *diffHandler) file(w http.ResponseWriter, r *http.Request) {
	p, err := h.getProject(r)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	filePath := r.URL.Query().Get("path")
	staged := r.URL.Query().Get("staged") == "true"

	// original: HEAD (or index if staged)
	var origRef string
	if staged {
		origRef = ":" + filePath // from index
	} else {
		origRef = "HEAD:" + filePath
	}

	origCmd := exec.CommandContext(r.Context(), "git", "show", origRef)
	origCmd.Dir = p.Path
	original, _ := origCmd.Output()

	// modified: working tree (or index if staged)
	var modified []byte
	if staged {
		modCmd := exec.CommandContext(r.Context(), "git", "show", ":"+filePath)
		modCmd.Dir = p.Path
		modified, _ = modCmd.Output()
	} else {
		modCmd := exec.CommandContext(r.Context(), "cat", p.Path+"/"+filePath)
		modCmd.Dir = p.Path
		modified, _ = modCmd.Output()
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"original": string(original),
		"modified": string(modified),
	})
}

func (h *diffHandler) getProject(r *http.Request) (*store.Project, error) {
	id := r.PathValue("id")
	p, err := h.store.GetProject(r.Context(), id)
	if err != nil || p == nil {
		return nil, err
	}
	return p, nil
}
