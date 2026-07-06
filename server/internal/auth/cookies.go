package auth

import (
	"net/http"
	"strings"
	"time"
)

// SetTokenCookie stores the JWT in an HttpOnly session cookie.
func SetTokenCookie(w http.ResponseWriter, r *http.Request, publicURL, token string, maxAge time.Duration) {
	secure := cookieSecure(publicURL, r)
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

func cookieSecure(publicURL string, r *http.Request) bool {
	if strings.HasPrefix(strings.ToLower(publicURL), "https://") {
		return true
	}
	if r != nil && r.TLS != nil {
		return true
	}
	if r != nil && strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		return true
	}
	return false
}
