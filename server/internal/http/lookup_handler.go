package httpapi

import (
	"errors"
	"net/http"

	"github.com/hanakokoizumi/pairlink/server/internal/room"
)

// LookupHandler serves GET /api/rooms/lookup.
type LookupHandler struct {
	rooms *room.Manager
}

// NewLookupHandler creates a lookup handler.
func NewLookupHandler(rooms *room.Manager) *LookupHandler {
	return &LookupHandler{rooms: rooms}
}

type lookupResponse struct {
	RoomID    string `json:"roomId"`
	ExpiresAt string `json:"expiresAt"`
}

// Lookup handles room code lookup for guests.
func (h *LookupHandler) Lookup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	code := room.NormalizeCode(r.URL.Query().Get("code"))
	if !room.ValidateCodeFormat(code, h.rooms.CodeLength()) {
		writeError(w, http.StatusBadRequest, "invalid_code")
		return
	}

	found, err := h.rooms.FindByCode(code)
	if err != nil {
		switch {
		case errors.Is(err, room.ErrRoomExpired):
			writeError(w, http.StatusGone, "room_expired")
		case errors.Is(err, room.ErrRoomNotFound):
			writeError(w, http.StatusNotFound, "room_not_found")
		default:
			writeError(w, http.StatusInternalServerError, "lookup_failed")
		}
		return
	}

	if h.rooms.IsRoomFull(found.ID) {
		writeError(w, http.StatusConflict, "room_full")
		return
	}

	writeJSON(w, http.StatusOK, lookupResponse{
		RoomID:    found.ID,
		ExpiresAt: found.ExpiresAt.UTC().Format(http.TimeFormat),
	})
}
