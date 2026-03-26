package api

import (
	"encoding/json"
	"net/http"

	"github.com/cookieshake/gosok-terminal/internal/store"
)

// DefaultSettings holds default JSON values for each setting key.
// Used for initialization on startup and for fallback on DELETE (reset).
var DefaultSettings = map[string]string{
	"ai_tools": `[
  {"type":"claude-code","label":"Claude","command":"claude","enabled":true},
  {"type":"codex","label":"Codex","command":"codex","enabled":true},
  {"type":"gemini-cli","label":"Gemini","command":"gemini","enabled":true},
  {"type":"opencode","label":"Open","command":"opencode","enabled":true}
]`,
	"font_size": `14`,
}

type settingsHandler struct {
	store store.Store
}

// list: GET /api/v1/settings
func (h *settingsHandler) list(w http.ResponseWriter, r *http.Request) {
	stored, err := h.store.ListSettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Merge defaults: keys missing from DB return default values
	result := make(map[string]json.RawMessage, len(DefaultSettings))
	for k, defVal := range DefaultSettings {
		raw := json.RawMessage(defVal)
		if v, ok := stored[k]; ok {
			raw = json.RawMessage(v)
		}
		result[k] = raw
	}
	writeJSON(w, http.StatusOK, result)
}

// get: GET /api/v1/settings/{key}
func (h *settingsHandler) get(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	val, err := h.store.GetSetting(r.Context(), key)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if val == "" {
		def, ok := DefaultSettings[key]
		if !ok {
			writeError(w, http.StatusNotFound, "setting not found")
			return
		}
		val = def
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(val)) //nolint:errcheck
}

// set: PUT /api/v1/settings/{key}
func (h *settingsHandler) set(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if _, ok := DefaultSettings[key]; !ok {
		writeError(w, http.StatusNotFound, "setting not found")
		return
	}

	var body struct {
		Value json.RawMessage `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Value == nil {
		writeError(w, http.StatusBadRequest, "value is required")
		return
	}

	if err := h.store.SetSetting(r.Context(), key, string(body.Value)); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(body.Value) //nolint:errcheck
}

// reset: DELETE /api/v1/settings/{key} — removes from DB, next read returns default
func (h *settingsHandler) reset(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	def, ok := DefaultSettings[key]
	if !ok {
		writeError(w, http.StatusNotFound, "setting not found")
		return
	}
	if err := h.store.DeleteSetting(r.Context(), key); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(def)) //nolint:errcheck
}
