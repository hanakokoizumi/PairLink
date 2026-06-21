package auth

import (
	"testing"

	"golang.org/x/crypto/bcrypt"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func validBcrypt(t *testing.T, password string) string {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	require.NoError(t, err)
	return string(hash)
}

func TestParseLocalUsers_multiple(t *testing.T) {
	h1 := validBcrypt(t, "secret")
	h2 := validBcrypt(t, "another")
	raw := "admin:" + h1 + "|alice:" + h2
	store, err := ParseLocalUsers(raw)
	require.NoError(t, err)
	assert.Equal(t, 2, store.Len())
	_, ok := store.Get("admin")
	assert.True(t, ok)
	_, ok = store.Get("alice")
	assert.True(t, ok)
}

func TestParseLocalUsers_empty(t *testing.T) {
	store, err := ParseLocalUsers("")
	require.NoError(t, err)
	assert.Equal(t, 0, store.Len())
}

func TestParseLocalUsers_invalidUsername(t *testing.T) {
	h := validBcrypt(t, "x")
	_, err := ParseLocalUsers("bad name:" + h)
	require.Error(t, err)
}

func TestParseLocalUsers_duplicate(t *testing.T) {
	h := validBcrypt(t, "x")
	_, err := ParseLocalUsers("admin:" + h + "|admin:" + h)
	require.Error(t, err)
}

func TestParseLocalUsers_invalidHash(t *testing.T) {
	_, err := ParseLocalUsers("admin:not-a-hash")
	require.Error(t, err)
}
