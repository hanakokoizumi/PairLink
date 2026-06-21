package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyDefaults_zeroConfig(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	t.Setenv("PAIRLINK_USERS", "")
	t.Setenv("OIDC_ENABLED", "false")
	t.Setenv("DISABLE_AUTH", "false")

	cfg := &Config{
		PublicURL:     "http://localhost:8080",
		JWTExpire:     "24h",
		RoomCodeTTL:   "30m",
		RTCConfigJSON: `{"iceServers":[{"urls":"stun:stun.l.google.com:19302"}]}`,
	}
	err := ApplyDefaults(cfg)
	require.NoError(t, err)

	assert.True(t, cfg.DisableAuth)
	assert.NotEmpty(t, cfg.JWTSecret)
	assert.True(t, cfg.EphemeralJWTSecret)
}

func TestApplyDefaults_withUsersRequiresAuth(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("OIDC_ENABLED", "false")

	cfg := &Config{
		PublicURL:     "http://localhost:8080",
		JWTSecret:     "test-secret",
		PairlinkUsers: "admin:$2b$12$abcdefghijklmnopqrstuv",
		DisableAuth:   false,
		JWTExpire:     "24h",
		RoomCodeTTL:   "30m",
		RTCConfigJSON: `{"iceServers":[{"urls":"stun:stun.l.google.com:19302"}]}`,
	}
	err := ApplyDefaults(cfg)
	require.NoError(t, err)

	assert.False(t, cfg.DisableAuth)
	assert.False(t, cfg.EphemeralJWTSecret)
}

func TestApplyDefaults_explicitDisableAuth(t *testing.T) {
	cfg := &Config{
		PublicURL:     "http://localhost:8080",
		JWTSecret:     "fixed",
		DisableAuth:   true,
		JWTExpire:     "24h",
		RoomCodeTTL:   "30m",
		RTCConfigJSON: `{"iceServers":[{"urls":"stun:stun.l.google.com:19302"}]}`,
	}
	err := ApplyDefaults(cfg)
	require.NoError(t, err)
	assert.True(t, cfg.DisableAuth)
}

func TestLoad_integration(t *testing.T) {
	t.Setenv("JWT_SECRET", "integration-secret")
	t.Setenv("PAIRLINK_USERS", "")
	t.Setenv("OIDC_ENABLED", "false")
	t.Setenv("PUBLIC_URL", "http://example.test")

	cfg, err := Load()
	require.NoError(t, err)
	assert.Equal(t, "http://example.test", cfg.PublicURL)
}

func TestShouldLoadDotenv(t *testing.T) {
	t.Setenv("PAIRLINK_LOAD_DOTENV", "false")
	assert.False(t, ShouldLoadDotenv())

	t.Setenv("PAIRLINK_LOAD_DOTENV", "true")
	assert.True(t, ShouldLoadDotenv())
}

func TestParseAllowList(t *testing.T) {
	assert.Nil(t, ParseAllowList(""))
	assert.Equal(t, []string{"a", "b", "c"}, ParseAllowList("a, b ,c"))
}

func TestToPublicConfig(t *testing.T) {
	cfg := &Config{
		PublicURL:        "http://localhost:8080",
		DisableAuth:      true,
		JWTExpire:        "24h",
		RoomCodeTTL:      "30m",
		RTCConfigJSON:    `{"iceServers":[{"urls":"stun:stun.l.google.com:19302"}]}`,
		AutoAcceptFiles:  true,
		DefaultTheme:     "dark",
		DefaultLocale:    "zh-CN",
		SupportedLocales: "zh-CN,en",
		RoomCodeLength:   5,
		ICETimeoutSec:    15,
		FileMaxSizeBytes: 1024,
		MessageMaxLength: 100,
	}
	require.NoError(t, ApplyDefaults(cfg))

	pub, err := cfg.ToPublicConfig()
	require.NoError(t, err)
	assert.True(t, pub.DisableAuth)
	assert.Equal(t, []string{"zh-CN", "en"}, pub.Settings.SupportedLocales)
}
