package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"os/exec"

	"github.com/cookieshake/gosok-terminal/internal/store"
)

type diffHandler struct {
	store store.Store
}

type diffFile struct {
	Path   string `json:"path"`
	Status string `json:"status"`
}

type commitEntry struct {
	SHA      string `json:"sha"`
	ShortSHA string `json:"short_sha"`
	Subject  string `json:"subject"`
	Author   string `json:"author"`
	Time     string `json:"time"`
}

// GET /api/v1/projects/{id}/diff?staged=true — list changed files in working tree
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

	writeJSON(w, http.StatusOK, parseNameStatus(out))
}

// GET /api/v1/projects/{id}/commits?limit=100 — recent commits on HEAD
func (h *diffHandler) commits(w http.ResponseWriter, r *http.Request) {
	p, err := h.getProject(r)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	limit := 100
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 1000 {
			limit = n
		}
	}

	// Tab-separated: %H \t %h \t %s \t %an \t %aI
	cmd := exec.CommandContext(r.Context(), "git", "log",
		"--pretty=format:%H%x09%h%x09%s%x09%an%x09%aI",
		"-n", strconv.Itoa(limit))
	cmd.Dir = p.Path
	out, _ := cmd.Output()

	commits := []commitEntry{}
	for _, line := range strings.Split(strings.TrimRight(string(out), "\n"), "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 5)
		if len(parts) < 5 {
			continue
		}
		commits = append(commits, commitEntry{
			SHA: parts[0], ShortSHA: parts[1], Subject: parts[2],
			Author: parts[3], Time: parts[4],
		})
	}
	writeJSON(w, http.StatusOK, commits)
}

// GET /api/v1/projects/{id}/commits/{sha}/files — files changed in a commit
func (h *diffHandler) commitFiles(w http.ResponseWriter, r *http.Request) {
	p, err := h.getProject(r)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	sha := r.PathValue("sha")
	if !isValidRef(sha) {
		writeError(w, http.StatusBadRequest, "invalid sha")
		return
	}

	// --no-commit-id keeps output as plain name-status, -m -r handles merges/renames,
	// --first-parent picks the mainline diff for merge commits.
	cmd := exec.CommandContext(r.Context(), "git", "show",
		"--no-commit-id", "--first-parent", "--name-status", "--pretty=format:", sha)
	cmd.Dir = p.Path
	out, _ := cmd.Output()

	writeJSON(w, http.StatusOK, parseNameStatus(out))
}

// GET /api/v1/projects/{id}/diff/file?path=...&staged=true — original + modified content.
// If ref=<sha>, returns <sha>^ vs <sha>; otherwise uses staged/unstaged logic.
func (h *diffHandler) file(w http.ResponseWriter, r *http.Request) {
	p, err := h.getProject(r)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		writeError(w, http.StatusBadRequest, "path required")
		return
	}
	ref := r.URL.Query().Get("ref")
	staged := r.URL.Query().Get("staged") == "true"

	var origRef, modRef string
	var modFromWorkTree bool

	switch {
	case ref != "":
		if !isValidRef(ref) {
			writeError(w, http.StatusBadRequest, "invalid ref")
			return
		}
		origRef = ref + "^:" + filePath
		modRef = ref + ":" + filePath
	case staged:
		origRef = "HEAD:" + filePath
		modRef = ":" + filePath
	default:
		origRef = "HEAD:" + filePath
		modFromWorkTree = true
	}

	original, _ := gitShow(r, p.Path, origRef)

	var modified []byte
	if modFromWorkTree {
		// Read working-tree file directly; avoids spawning `cat` and resolves the path safely.
		modified, _ = os.ReadFile(filepath.Join(p.Path, filePath))
	} else {
		modified, _ = gitShow(r, p.Path, modRef)
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

func gitShow(r *http.Request, dir, ref string) ([]byte, error) {
	cmd := exec.CommandContext(r.Context(), "git", "show", ref)
	cmd.Dir = dir
	return cmd.Output()
}

func parseNameStatus(out []byte) []diffFile {
	files := []diffFile{}
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
	return files
}

// isValidRef rejects refs with shell/path-traversal characters before passing to git.
func isValidRef(s string) bool {
	if s == "" || len(s) > 200 {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z',
			r >= 'A' && r <= 'Z',
			r >= '0' && r <= '9',
			r == '-', r == '_', r == '/', r == '.':
		default:
			return false
		}
	}
	return true
}
