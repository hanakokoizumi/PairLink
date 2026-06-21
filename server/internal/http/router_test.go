package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hanakokoizumi/pairlink/server/internal/auth"
	"github.com/hanakokoizumi/pairlink/server/internal/config"
	"github.com/hanakokoizumi/pairlink/server/internal/room"
	"github.com/hanakokoizumi/pairlink/server/internal/ws"
)

func TestRouter_healthAndConfig(t *testing.T) {
	cfg := &config.Config{
		PublicURL:     "http://localhost:8080",
		DisableAuth:   true,
		JWTSecret:     "secret",
		JWTExpire:     "24h",
		RoomCodeTTL:   "30m",
		RTCConfigJSON: `{"iceServers":[]}`,
	}
	require.NoError(t, config.ApplyDefaults(cfg))

	rooms := room.NewManager(30 * time.Minute)
	defer rooms.Stop()
	hub := ws.NewHub(rooms)
	svc := auth.NewService(auth.NewLocalUserStore(), auth.NewJWTManager("secret", time.Hour), nil, true)

	router := NewRouter(Deps{Config: cfg, Auth: svc, Rooms: rooms, Hub: hub})

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)

	req = httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
}
