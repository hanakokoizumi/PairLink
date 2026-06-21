package auth

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
)

const (
	userFieldSep  = ':'
	userRecordSep = '|'
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserNotFound       = errors.New("user not found")

	usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,32}$`)
)

// LocalUser holds a username and bcrypt hash from PAIRLINK_USERS.
type LocalUser struct {
	Username     string
	PasswordHash string
}

// LocalUserStore is an in-memory map of local users.
type LocalUserStore struct {
	mu     sync.RWMutex
	byName map[string]LocalUser
}

// NewLocalUserStore creates an empty store.
func NewLocalUserStore() *LocalUserStore {
	return &LocalUserStore{byName: make(map[string]LocalUser)}
}

// ParseLocalUsers parses PAIRLINK_USERS env format.
func ParseLocalUsers(raw string) (*LocalUserStore, error) {
	store := NewLocalUserStore()
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return store, nil
	}

	records := strings.Split(raw, string(userRecordSep))
	for _, record := range records {
		record = strings.TrimSpace(record)
		if record == "" {
			continue
		}
		parts := strings.SplitN(record, string(userFieldSep), 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid user record: missing field separator")
		}
		username := strings.TrimSpace(parts[0])
		hash := strings.TrimSpace(parts[1])
		if !usernamePattern.MatchString(username) {
			return nil, fmt.Errorf("invalid username: %q", username)
		}
		if !strings.HasPrefix(hash, "$2") {
			return nil, fmt.Errorf("invalid bcrypt hash for user %q", username)
		}
		if _, exists := store.byName[username]; exists {
			return nil, fmt.Errorf("duplicate username: %q", username)
		}
		store.byName[username] = LocalUser{Username: username, PasswordHash: hash}
	}
	return store, nil
}

// Get returns a user by username.
func (s *LocalUserStore) Get(username string) (LocalUser, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.byName[username]
	return u, ok
}

// Len returns the number of users.
func (s *LocalUserStore) Len() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.byName)
}

// HasUsers reports whether any users are configured.
func (s *LocalUserStore) HasUsers() bool {
	return s.Len() > 0
}
