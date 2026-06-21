package auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJWTManager_IssueValidate(t *testing.T) {
	m := NewJWTManager("test-secret", time.Hour)
	token, err := m.Issue("user1", "user1")
	require.NoError(t, err)

	claims, err := m.Validate(token)
	require.NoError(t, err)
	assert.Equal(t, "user1", claims.Subject)
	assert.Equal(t, "user1", claims.Username)
}

func TestJWTManager_wrongSecret(t *testing.T) {
	m1 := NewJWTManager("secret-a", time.Hour)
	m2 := NewJWTManager("secret-b", time.Hour)
	token, err := m1.Issue("u", "u")
	require.NoError(t, err)
	_, err = m2.Validate(token)
	require.Error(t, err)
}

func TestJWTManager_expired(t *testing.T) {
	m := NewJWTManager("secret", time.Millisecond)
	token, err := m.Issue("u", "u")
	require.NoError(t, err)
	time.Sleep(5 * time.Millisecond)
	_, err = m.Validate(token)
	require.Error(t, err)
}
