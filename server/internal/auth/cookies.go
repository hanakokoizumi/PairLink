package auth

import (
	"net/http"
	"strings"
	"time"
)

// SetTokenCookie stores the JWT in an HttpOnly session cookie.
func SetTokenCookie(w http.ResponseWriter, publicURL, token string, maxAge time.Duration) {
	secure := strings.HasPrefix(strings.ToLower(publicURL), "https://")
	http.SetCookie(w, &http.Cookie{
		Name:     TokenCookieName(),
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(maxAge.Seconds()),
	})
}
