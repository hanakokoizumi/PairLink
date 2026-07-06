package httpapi

import (
	"net/http"
	"time"

	"github.com/go-chi/httprate"

	"github.com/hanakokoizumi/pairlink/server/internal/clientip"
	"github.com/hanakokoizumi/pairlink/server/internal/config"
)

func limitByClientIP(cfg *config.Config, limit int) func(http.Handler) http.Handler {
	if limit <= 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	return httprate.Limit(limit, time.Minute, httprate.WithKeyFuncs(func(r *http.Request) (string, error) {
		return clientip.FromRequest(r, cfg.TrustedProxyNets), nil
	}))
}

func rateLimitMiddleware(cfg *config.Config, limit int) func(http.Handler) http.Handler {
	if limit <= 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	return limitByClientIP(cfg, limit)
}
