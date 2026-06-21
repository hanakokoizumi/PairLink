package auth

import (
	"time"

	"golang.org/x/crypto/bcrypt"
)

// Service coordinates local and OIDC authentication.
type Service struct {
	localUsers *LocalUserStore
	jwt        *JWTManager
	oidc       *OIDCProvider
	disableAuth bool
}

// NewService creates an auth service.
func NewService(localUsers *LocalUserStore, jwt *JWTManager, oidc *OIDCProvider, disableAuth bool) *Service {
	if localUsers == nil {
		localUsers = NewLocalUserStore()
	}
	return &Service{
		localUsers:  localUsers,
		jwt:         jwt,
		oidc:        oidc,
		disableAuth: disableAuth,
	}
}

// DisableAuth reports whether authentication is disabled.
func (s *Service) DisableAuth() bool {
	return s.disableAuth
}

// JWT returns the JWT manager.
func (s *Service) JWT() *JWTManager {
	return s.jwt
}

// OIDC returns the OIDC provider.
func (s *Service) OIDC() *OIDCProvider {
	return s.oidc
}

// LocalUsers returns the local user store.
func (s *Service) LocalUsers() *LocalUserStore {
	return s.localUsers
}

// Login validates credentials and returns a JWT.
func (s *Service) Login(username, password string) (string, error) {
	u, ok := s.localUsers.Get(username)
	if !ok {
		return "", ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return "", ErrInvalidCredentials
	}
	return s.jwt.Issue(username, username)
}

// ValidateToken parses a bearer or cookie token.
func (s *Service) ValidateToken(token string) (*Claims, error) {
	return s.jwt.Validate(token)
}

// IssueAnonymous issues a token for disable-auth mode (optional).
func (s *Service) IssueAnonymous() (string, error) {
	return s.jwt.Issue("anonymous", "anonymous")
}

// TokenTTL exposes configured JWT lifetime.
func (s *Service) TokenTTL() time.Duration {
	// Caller should pass actual duration; kept for cookie max-age usage.
	return 24 * time.Hour
}
