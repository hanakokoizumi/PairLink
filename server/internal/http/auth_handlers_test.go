package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hanakokoizumi/pairlink/server/internal/auth"
	"github.com/hanakokoizumi/pairlink/server/internal/config"
)

func testAuthService(t *testing.T, disableAuth bool, users string) *auth.Service {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte("secret"), bcrypt.MinCost)
	require.NoError(t, err)
	if users == "" && !disableAuth {
		users = "admin:" + string(hash)
	}
	store, err := auth.ParseLocalUsers(users)
	require.NoError(t, err)
	jwt := auth.NewJWTManager("test-secret", time.Hour)
	return auth.NewService(store, jwt, nil, disableAuth)
}

func TestAuthHandlers_loginSuccess(t *testing.T) {
	svc := testAuthService(t, false, "")
	h := NewAuthHandlers(svc, "http://localhost:8080", time.Hour)

	body := `{"username":"admin","password":"secret"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.Login(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "token")
}

func TestAuthHandlers_loginFailure(t *testing.T) {
	svc := testAuthService(t, false, "")
	h := NewAuthHandlers(svc, "http://localhost:8080", time.Hour)

	body := `{"username":"admin","password":"wrong"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.Login(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "invalid_credentials")
}

func TestConfigHandler(t *testing.T) {
	cfg := &config.Config{
		PublicURL:     "http://localhost:8080",
		DisableAuth:   true,
		JWTExpire:     "24h",
		RoomCodeTTL:   "30m",
		RTCConfigJSON: `{"iceServers":[{"urls":"stun:stun.l.google.com:19302"}]}`,
		SupportedLocales: "zh-CN,en",
	}
	require.NoError(t, config.ApplyDefaults(cfg))

	h := NewConfigHandler(cfg)
	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "disableAuth")
}
