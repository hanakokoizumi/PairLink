package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/hanakokoizumi/pairlink/server/internal/auth"
)

// AuthHandlers serves authentication endpoints.
type AuthHandlers struct {
	auth *auth.Service
}

// NewAuthHandlers creates auth HTTP handlers.
func NewAuthHandlers(authSvc *auth.Service) *AuthHandlers {
	return &AuthHandlers{auth: authSvc}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string `json:"token"`
}

type meResponse struct {
	Subject  string `json:"sub"`
	Username string `json:"username"`
}

// Login handles POST /api/auth/login.
func (h *AuthHandlers) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if h.auth.DisableAuth() {
		writeError(w, http.StatusBadRequest, "auth_disabled")
		return
	}
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	token, err := h.auth.Login(req.Username, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_credentials")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     auth.TokenCookieName(),
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((24 * time.Hour).Seconds()),
	})
	writeJSON(w, http.StatusOK, loginResponse{Token: token})
}

// Me handles GET /api/auth/me.
func (h *AuthHandlers) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	writeJSON(w, http.StatusOK, meResponse{Subject: claims.Subject, Username: claims.Username})
}
