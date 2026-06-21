package auth

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOIDCPolicy_emptyRulesAllow(t *testing.T) {
	p := NewOIDCPolicy(nil, nil, nil, "groups", false)
	err := p.Allow(map[string]any{"email": "a@b.com"})
	require.NoError(t, err)
}

func TestOIDCPolicy_emailDomain(t *testing.T) {
	p := NewOIDCPolicy([]string{"company.com"}, nil, nil, "groups", false)
	require.NoError(t, p.Allow(map[string]any{"email": "user@company.com"}))
	assert.ErrorIs(t, p.Allow(map[string]any{"email": "user@other.com"}), ErrOIDCForbidden)
}

func TestOIDCPolicy_emailList(t *testing.T) {
	p := NewOIDCPolicy(nil, []string{"alice@example.com"}, nil, "groups", false)
	require.NoError(t, p.Allow(map[string]any{"email": "alice@example.com"}))
	assert.ErrorIs(t, p.Allow(map[string]any{"email": "bob@example.com"}), ErrOIDCForbidden)
}

func TestOIDCPolicy_groupsOR(t *testing.T) {
	p := NewOIDCPolicy(nil, nil, []string{"pairlink-users"}, "groups", false)
	require.NoError(t, p.Allow(map[string]any{"groups": []any{"pairlink-users", "other"}}))
	assert.ErrorIs(t, p.Allow(map[string]any{"groups": []any{"nope"}}), ErrOIDCForbidden)
}

func TestOIDCPolicy_requireVerified(t *testing.T) {
	p := NewOIDCPolicy(nil, nil, nil, "groups", true)
	assert.ErrorIs(t, p.Allow(map[string]any{"email_verified": false}), ErrOIDCForbidden)
	require.NoError(t, p.Allow(map[string]any{"email_verified": true}))
}
