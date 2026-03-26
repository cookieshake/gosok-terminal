package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type DirEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// listDirs: GET /api/v1/fs/dirs?path=/some/path
func listDirs(w http.ResponseWriter, r *http.Request) {
	reqPath := r.URL.Query().Get("path")
	if reqPath == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			home = "/"
		}
		reqPath = home
	}

	// Resolve and clean the path
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

	dirs := make([]DirEntry, 0)
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		// Skip hidden directories
		if strings.HasPrefix(e.Name(), ".") {
			continue
		}
		dirs = append(dirs, DirEntry{
			Name: e.Name(),
			Path: filepath.Join(abs, e.Name()),
		})
	}

	sort.Slice(dirs, func(i, j int) bool {
		return dirs[i].Name < dirs[j].Name
	})

	parent := ""
	if abs != "/" {
		parent = filepath.Dir(abs)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{ //nolint:errcheck
		"path":    abs,
		"parent":  parent,
		"entries": dirs,
	})
}
