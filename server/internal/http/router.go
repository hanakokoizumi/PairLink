package httpapi

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"

	"github.com/hanakokoizumi/pairlink/server/internal/auth"
	"github.com/hanakokoizumi/pairlink/server/internal/config"
	"github.com/hanakokoizumi/pairlink/server/internal/room"
	"github.com/hanakokoizumi/pairlink/server/internal/ws"
)

// Deps bundles router dependencies.
type Deps struct {
	Config   *config.Config
	Auth     *auth.Service
	Rooms    *room.Manager
	Hub      *ws.Hub
	WS       http.Handler
}

// NewRouter builds the HTTP router with all routes and middleware.
func NewRouter(deps Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(SecurityHeaders(deps.Config.SecurityHeaders, deps.Config.PublicURL))

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{deps.Config.PublicURL, "http://localhost:3000", "http://127.0.0.1:3000"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	if deps.Config.RateLimitPerIP > 0 {
		r.Use(httprate.LimitByIP(deps.Config.RateLimitPerIP, time.Minute))
	}

	jwtTTL, err := deps.Config.JWTExpireDuration()
	if err != nil {
		jwtTTL = 24 * time.Hour
	}

	configHandler := NewConfigHandler(deps.Config)
	authHandlers := NewAuthHandlers(deps.Auth, deps.Config.PublicURL, jwtTTL)
	roomHandlers := NewRoomHandlers(deps.Config, deps.Auth, deps.Rooms)
	lookupHandler := NewLookupHandler(deps.Rooms)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	r.Get("/api/config", configHandler.ServeHTTP)

	r.Route("/api/auth", func(ar chi.Router) {
		if deps.Config.LoginRateLimit > 0 {
			ar.Use(httprate.LimitByIP(deps.Config.LoginRateLimit, time.Minute))
		}
		ar.Post("/login", authHandlers.Login)
		if deps.Auth.OIDC() != nil && deps.Auth.OIDC().Enabled() {
			ar.Get("/oidc/start", deps.Auth.OIDC().StartHandler)
			ar.Get("/oidc/callback", deps.Auth.OIDC().CallbackHandler)
		}
		ar.With(deps.Auth.RequireAuth).Get("/me", authHandlers.Me)
	})

	r.Route("/api/rooms", func(rr chi.Router) {
		rr.With(deps.Auth.RequireAuth).Post("/", roomHandlers.Create)

		if deps.Config.JoinRateLimit > 0 {
			rr.With(httprate.LimitByIP(deps.Config.JoinRateLimit, time.Minute)).Get("/lookup", lookupHandler.Lookup)
		} else {
			rr.Get("/lookup", lookupHandler.Lookup)
		}
	})

	if deps.WS != nil {
		r.Get("/ws", deps.WS.ServeHTTP)
	}

	return r
}
