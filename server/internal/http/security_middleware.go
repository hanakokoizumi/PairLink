package httpapi

import (
	"net/http"
	"strings"
)

// SecurityHeaders adds production security headers when enabled.
func SecurityHeaders(enabled bool, publicURL string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if enabled {
				w.Header().Set("X-Content-Type-Options", "nosniff")
				w.Header().Set("X-Frame-Options", "DENY")
				w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
				w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
				w.Header().Set("Content-Security-Policy", strings.Join([]string{
					"default-src 'self'",
					"script-src 'self' 'unsafe-inline'",
					"style-src 'self' 'unsafe-inline'",
					"img-src 'self' data: blob:",
					"connect-src 'self' wss: https:",
					"font-src 'self'",
					"frame-ancestors 'none'",
					"base-uri 'self'",
				}, "; ")+";")
				if isHTTPS(publicURL, r) {
					w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func isHTTPS(publicURL string, r *http.Request) bool {
	if strings.HasPrefix(strings.ToLower(publicURL), "https://") {
		return true
	}
	if r.TLS != nil {
		return true
	}
	if strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		return true
	}
	return false
}
