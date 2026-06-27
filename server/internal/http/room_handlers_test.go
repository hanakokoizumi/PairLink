package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hanakokoizumi/pairlink/server/internal/auth"
	"github.com/hanakokoizumi/pairlink/server/internal/config"
	"github.com/hanakokoizumi/pairlink/server/internal/room"
)

func TestRoomHandlers_disableAuth(t *testing.T) {
	cfg := &config.Config{
		PublicURL:     "http://localhost:8080",
		DisableAuth:   true,
		JWTSecret:     "secret",
		JWTExpire:     "24h",
		RoomCodeTTL:   "30m",
		RTCConfigJSON: `{"iceServers":[]}`,
	}
	require.NoError(t, config.ApplyDefaults(cfg))

	rooms := room.NewManager(30 * time.Minute, 5)
	defer rooms.Stop()
	svc := auth.NewService(auth.NewLocalUserStore(), auth.NewJWTManager("secret", time.Hour), nil, true)
	h := NewRoomHandlers(cfg, svc, rooms)

	req := httptest.NewRequest(http.MethodPost, "/api/rooms", nil)
	rec := httptest.NewRecorder()
	h.Create(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "roomId")
}

func TestRoomHandlers_requiresAuth(t *testing.T) {
	cfg := &config.Config{
		PublicURL:     "http://localhost:8080",
		DisableAuth:   false,
		JWTSecret:     "secret",
		JWTExpire:     "24h",
		RoomCodeTTL:   "30m",
		RTCConfigJSON: `{"iceServers":[]}`,
	}
	require.NoError(t, config.ApplyDefaults(cfg))

	rooms := room.NewManager(30 * time.Minute, 5)
	defer rooms.Stop()
	svc := testAuthService(t, false, "")
	h := NewRoomHandlers(cfg, svc, rooms)

	req := httptest.NewRequest(http.MethodPost, "/api/rooms", nil)
	rec := httptest.NewRecorder()
	h.Create(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestRoomHandlers_withToken(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("secret"), bcrypt.MinCost)
	require.NoError(t, err)

	cfg := &config.Config{
		PublicURL:     "http://localhost:8080",
		DisableAuth:   false,
		JWTSecret:     "test-secret",
		PairlinkUsers: "admin:" + string(hash),
		JWTExpire:     "24h",
		RoomCodeTTL:   "30m",
		RTCConfigJSON: `{"iceServers":[]}`,
	}
	require.NoError(t, config.ApplyDefaults(cfg))

	rooms := room.NewManager(30 * time.Minute, 5)
	defer rooms.Stop()
	svc := testAuthService(t, false, "")
	token, err := svc.Login("admin", "secret")
	require.NoError(t, err)

	h := NewRoomHandlers(cfg, svc, rooms)
	req := httptest.NewRequest(http.MethodPost, "/api/rooms", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	svc.RequireAuth(http.HandlerFunc(h.Create)).ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
}
