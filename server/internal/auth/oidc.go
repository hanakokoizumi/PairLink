package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// OIDCProvider wraps OIDC discovery and OAuth2 config.
type OIDCProvider struct {
	enabled      bool
	redirectURL  string
	oauth2Config oauth2.Config
	verifier     *oidc.IDTokenVerifier
	policy       *OIDCPolicy
	jwt          *JWTManager
	jwtMaxAge    time.Duration
	publicURL    string

	mu     sync.Mutex
	states map[string]oidcState
}

type oidcState struct {
	nonce    string
	issuedAt time.Time
}

// OIDCConfig holds OIDC initialization parameters.
type OIDCConfig struct {
	Enabled      bool
	Issuer       string
	ClientID     string
	ClientSecret string
	RedirectURL  string
	PublicURL    string
	Policy       *OIDCPolicy
	JWT          *JWTManager
	JWTMaxAge    time.Duration
}

// NewOIDCProvider initializes OIDC when enabled and configured.
func NewOIDCProvider(ctx context.Context, cfg OIDCConfig) (*OIDCProvider, error) {
	p := &OIDCProvider{
		enabled:   cfg.Enabled,
		redirectURL: cfg.RedirectURL,
		policy:    cfg.Policy,
		jwt:       cfg.JWT,
		jwtMaxAge: cfg.JWTMaxAge,
		publicURL: cfg.PublicURL,
		states:    make(map[string]oidcState),
	}
	if !cfg.Enabled {
		return p, nil
	}
	if cfg.Issuer == "" || cfg.ClientID == "" || cfg.ClientSecret == "" || cfg.RedirectURL == "" {
		return p, nil
	}

	provider, err := oidc.NewProvider(ctx, cfg.Issuer)
	if err != nil {
		return nil, fmt.Errorf("oidc provider: %w", err)
	}
	p.oauth2Config = oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}
	p.verifier = provider.Verifier(&oidc.Config{ClientID: cfg.ClientID})
	p.enabled = true
	go p.cleanupStates()
	return p, nil
}

func (p *OIDCProvider) cleanupStates() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		p.mu.Lock()
		now := time.Now()
		for k, v := range p.states {
			if now.Sub(v.issuedAt) > 10*time.Minute {
				delete(p.states, k)
			}
		}
		p.mu.Unlock()
	}
}

// Enabled reports whether OIDC login is available.
func (p *OIDCProvider) Enabled() bool {
	return p.enabled && p.verifier != nil
}

// StartHandler redirects to the OIDC provider authorization URL.
func (p *OIDCProvider) StartHandler(w http.ResponseWriter, r *http.Request) {
	if !p.Enabled() {
		http.Error(w, `{"code":"oidc_disabled"}`, http.StatusNotFound)
		return
	}
	state, err := randomToken()
	if err != nil {
		http.Error(w, `{"code":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	nonce, err := randomToken()
	if err != nil {
		http.Error(w, `{"code":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	p.mu.Lock()
	p.states[state] = oidcState{nonce: nonce, issuedAt: time.Now()}
	p.mu.Unlock()

	url := p.oauth2Config.AuthCodeURL(state, oidc.Nonce(nonce))
	http.Redirect(w, r, url, http.StatusFound)
}

// CallbackHandler completes OIDC login and sets session cookie.
func (p *OIDCProvider) CallbackHandler(w http.ResponseWriter, r *http.Request) {
	if !p.Enabled() {
		http.Error(w, `{"code":"oidc_disabled"}`, http.StatusNotFound)
		return
	}

	state := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")
	if state == "" || code == "" {
		http.Error(w, `{"code":"oidc_invalid_request"}`, http.StatusBadRequest)
		return
	}

	p.mu.Lock()
	st, ok := p.states[state]
	delete(p.states, state)
	p.mu.Unlock()
	if !ok {
		http.Error(w, `{"code":"oidc_invalid_state"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	oauth2Token, err := p.oauth2Config.Exchange(ctx, code)
	if err != nil {
		http.Error(w, `{"code":"oidc_exchange_failed"}`, http.StatusBadRequest)
		return
	}
	rawIDToken, ok := oauth2Token.Extra("id_token").(string)
	if !ok {
		http.Error(w, `{"code":"oidc_missing_id_token"}`, http.StatusBadRequest)
		return
	}
	idToken, err := p.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		http.Error(w, `{"code":"oidc_invalid_token"}`, http.StatusBadRequest)
		return
	}
	if idToken.Nonce != st.nonce {
		http.Error(w, `{"code":"oidc_invalid_nonce"}`, http.StatusBadRequest)
		return
	}

	var claims map[string]any
	if err := idToken.Claims(&claims); err != nil {
		http.Error(w, `{"code":"oidc_invalid_claims"}`, http.StatusBadRequest)
		return
	}
	if err := p.policy.Allow(claims); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]string{"code": "oidc_forbidden"})
		return
	}

	sub, err := SubjectFromClaims(claims)
	if err != nil {
		http.Error(w, `{"code":"oidc_invalid_claims"}`, http.StatusBadRequest)
		return
	}
	username := UsernameFromClaims(claims)
	token, err := p.jwt.Issue(sub, username)
	if err != nil {
		http.Error(w, `{"code":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	SetTokenCookie(w, r, p.publicURL, token, p.jwtMaxAge)
	http.Redirect(w, r, p.publicURL+"/?logged_in=1", http.StatusFound)
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
