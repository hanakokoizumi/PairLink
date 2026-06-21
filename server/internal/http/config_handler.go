package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/hanakokoizumi/pairlink/server/internal/config"
)

// ConfigHandler serves GET /api/config.
type ConfigHandler struct {
	cfg *config.Config
}

// NewConfigHandler creates a config handler.
func NewConfigHandler(cfg *config.Config) *ConfigHandler {
	return &ConfigHandler{cfg: cfg}
}

func (h *ConfigHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	pub, err := h.cfg.ToPublicConfig()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "config_error")
		return
	}
	writeJSON(w, http.StatusOK, pub)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"code": code})
}
