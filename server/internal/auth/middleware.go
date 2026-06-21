package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const claimsContextKey contextKey = "claims"

// ClaimsFromContext returns JWT claims stored by middleware.
func ClaimsFromContext(ctx context.Context) (*Claims, bool) {
	claims, ok := ctx.Value(claimsContextKey).(*Claims)
	return claims, ok
}

func withClaims(ctx context.Context, claims *Claims) context.Context {
	return context.WithValue(ctx, claimsContextKey, claims)
}

// ExtractToken reads Bearer header or session cookie.
func ExtractToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
	}
	if c, err := r.Cookie(TokenCookieName()); err == nil {
		return c.Value
	}
	return r.URL.Query().Get("token")
}

// RequireAuth rejects unauthenticated requests unless auth is disabled.
func (s *Service) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.disableAuth {
			next.ServeHTTP(w, r)
			return
		}
		token := ExtractToken(r)
		if token == "" {
			writeUnauthorized(w)
			return
		}
		claims, err := s.ValidateToken(token)
		if err != nil {
			writeUnauthorized(w)
			return
		}
		next.ServeHTTP(w, r.WithContext(withClaims(r.Context(), claims)))
	})
}

// OptionalAuth attaches claims when a valid token is present.
func (s *Service) OptionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.disableAuth {
			next.ServeHTTP(w, r)
			return
		}
		token := ExtractToken(r)
		if token != "" {
			if claims, err := s.ValidateToken(token); err == nil {
				r = r.WithContext(withClaims(r.Context(), claims))
			}
		}
		next.ServeHTTP(w, r)
	})
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(`{"code":"unauthorized"}`))
}
