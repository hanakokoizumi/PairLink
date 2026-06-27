package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/hanakokoizumi/pairlink/server/internal/auth"
	"github.com/hanakokoizumi/pairlink/server/internal/config"
	httpapi "github.com/hanakokoizumi/pairlink/server/internal/http"
	"github.com/hanakokoizumi/pairlink/server/internal/relay"
	"github.com/hanakokoizumi/pairlink/server/internal/room"
	"github.com/hanakokoizumi/pairlink/server/internal/ws"
)

func main() {
	if err := run(); err != nil {
		log.Fatal().Err(err).Msg("server failed")
	}
}

func run() error {
	_ = flag.CommandLine.Parse(nil)

	if config.ShouldLoadDotenv() {
		_ = godotenv.Load()
	}

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	setupLogger(cfg.LogLevel)
	logStartupWarnings(cfg)

	jwtTTL, err := cfg.JWTExpireDuration()
	if err != nil {
		return err
	}

	localUsers, err := auth.ParseLocalUsers(cfg.PairlinkUsers)
	if err != nil {
		return fmt.Errorf("parse users: %w", err)
	}

	jwtMgr := auth.NewJWTManager(cfg.JWTSecret, jwtTTL)
	policy := auth.NewOIDCPolicy(
		config.ParseAllowList(cfg.OIDCAllowEmailDomains),
		config.ParseAllowList(cfg.OIDCAllowEmails),
		config.ParseAllowList(cfg.OIDCAllowGroups),
		cfg.OIDCGroupsClaim,
		cfg.OIDCRequireEmailVerified,
	)

	ctx := context.Background()
	oidcProvider, err := auth.NewOIDCProvider(ctx, auth.OIDCConfig{
		Enabled:      cfg.OIDCEnabled,
		Issuer:       cfg.OIDCIssuer,
		ClientID:     cfg.OIDCClientID,
		ClientSecret: cfg.OIDCClientSecret,
		RedirectURL:  cfg.OIDCRedirectURL,
		PublicURL:    cfg.PublicURL,
		Policy:       policy,
		JWT:          jwtMgr,
		JWTMaxAge:    jwtTTL,
	})
	if err != nil {
		return fmt.Errorf("oidc: %w", err)
	}

	authSvc := auth.NewService(localUsers, jwtMgr, oidcProvider, cfg.DisableAuth)

	roomTTL, err := cfg.RoomCodeTTLDuration()
	if err != nil {
		return err
	}
	roomMgr := room.NewManager(roomTTL, cfg.RoomCodeLength)
	defer roomMgr.Stop()

	relayFwd := relay.NewForwarder()
	hub := ws.NewHub(roomMgr)
	wsHandler := ws.NewHandler(cfg, authSvc, hub, roomMgr, relayFwd)

	router := httpapi.NewRouter(httpapi.Deps{
		Config: cfg,
		Auth:   authSvc,
		Rooms:  roomMgr,
		Hub:    hub,
		WS:     wsHandler,
	})

	addr := fmt.Sprintf(":%d", cfg.Port)
	server := &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info().Str("addr", addr).Msg("pairlink server listening")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		return err
	case sig := <-sigCh:
		log.Info().Str("signal", sig.String()).Msg("shutting down")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	return server.Shutdown(shutdownCtx)
}

func setupLogger(level string) {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	switch level {
	case "debug":
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	case "warn":
		zerolog.SetGlobalLevel(zerolog.WarnLevel)
	case "error":
		zerolog.SetGlobalLevel(zerolog.ErrorLevel)
	default:
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
}

func logStartupWarnings(cfg *config.Config) {
	if cfg.EphemeralJWTSecret {
		log.Warn().Msg("ephemeral JWT secret in use; set JWT_SECRET for production")
	}
	if cfg.DisableAuth {
		log.Warn().Msg("authentication disabled (zero-config or DISABLE_AUTH=true)")
	}
}
