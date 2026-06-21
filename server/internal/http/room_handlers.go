package httpapi

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/hanakokoizumi/pairlink/server/internal/auth"
	"github.com/hanakokoizumi/pairlink/server/internal/config"
	"github.com/hanakokoizumi/pairlink/server/internal/room"
)

// RoomHandlers serves room creation.
type RoomHandlers struct {
	cfg   *config.Config
	auth  *auth.Service
	rooms *room.Manager
}

// NewRoomHandlers creates room HTTP handlers.
func NewRoomHandlers(cfg *config.Config, authSvc *auth.Service, rooms *room.Manager) *RoomHandlers {
	return &RoomHandlers{cfg: cfg, auth: authSvc, rooms: rooms}
}

type createRoomResponse struct {
	RoomID    string `json:"roomId"`
	Code      string `json:"code"`
	URL       string `json:"url"`
	ExpiresAt string `json:"expiresAt"`
}

// Create handles POST /api/rooms.
func (h *RoomHandlers) Create(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	hostPeerID := uuid.NewString()
	if !h.auth.DisableAuth() {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		hostPeerID = claims.Subject
	}

	created, err := h.rooms.Create(hostPeerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "room_create_failed")
		return
	}

	base := strings.TrimRight(h.cfg.PublicURL, "/")
	writeJSON(w, http.StatusOK, createRoomResponse{
		RoomID:    created.ID,
		Code:      created.Code,
		URL:       base + "/r/" + created.Code,
		ExpiresAt: created.ExpiresAt.UTC().Format(http.TimeFormat),
	})
}
