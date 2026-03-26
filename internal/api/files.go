package api

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type FileEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"is_dir"`
}

// listFiles: GET /api/v1/fs/files?path=/some/path
// Returns both files and directories (one level, not recursive).
func listFiles(w http.ResponseWriter, r *http.Request) {
	reqPath := r.URL.Query().Get("path")
	if reqPath == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return
	}

	abs, err := filepath.Abs(reqPath)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid path")
		return
	}

	entries, err := os.ReadDir(abs)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var dirs, files []FileEntry
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".") {
			continue
		}
		entry := FileEntry{
			Name:  e.Name(),
			Path:  filepath.Join(abs, e.Name()),
			IsDir: e.IsDir(),
		}
		if e.IsDir() {
			dirs = append(dirs, entry)
		} else {
			files = append(files, entry)
		}
	}

	sort.Slice(dirs, func(i, j int) bool { return dirs[i].Name < dirs[j].Name })
	sort.Slice(files, func(i, j int) bool { return files[i].Name < files[j].Name })

	result := append(dirs, files...)
	if result == nil {
		result = []FileEntry{}
	}

	writeJSON(w, http.StatusOK, result)
}

// readFile: GET /api/v1/fs/file?path=/some/file.txt
func readFile(w http.ResponseWriter, r *http.Request) {
	reqPath := r.URL.Query().Get("path")
	if reqPath == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return
	}

	abs, err := filepath.Abs(reqPath)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid path")
		return
	}

	info, err := os.Stat(abs)
	if err != nil {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}
	if info.IsDir() {
		writeError(w, http.StatusBadRequest, "path is a directory")
		return
	}
	// 10MB limit
	if info.Size() > 10*1024*1024 {
		writeError(w, http.StatusRequestEntityTooLarge, "file too large (max 10MB)")
		return
	}

	f, err := os.Open(abs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer f.Close()

	content, err := io.ReadAll(f)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"path":    abs,
		"content": string(content),
	})
}

// writeFile: PUT /api/v1/fs/file?path=/some/file.txt
func writeFile(w http.ResponseWriter, r *http.Request) {
	reqPath := r.URL.Query().Get("path")
	if reqPath == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return
	}

	abs, err := filepath.Abs(reqPath)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid path")
		return
	}

	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := os.WriteFile(abs, []byte(body.Content), 0644); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
