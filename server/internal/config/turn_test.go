package config

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveTurnHost(t *testing.T) {
	cfg := &Config{PublicURL: "https://pairlink.example.com:8443"}
	assert.Equal(t, "pairlink.example.com", cfg.ResolveTurnHost())

	cfg.TurnHost = "turn.example.com"
	assert.Equal(t, "turn.example.com", cfg.ResolveTurnHost())
}

func TestFinalizeRTCConfig_injectsAutoTurn(t *testing.T) {
	cfg := &Config{
		PublicURL:     "http://localhost:8080",
		STUNServers:   "stun.l.google.com:19302",
		RTCConfigJSON: `{"iceServers":[]}`,
		TurnEnabled:   true,
		TurnUser:      "pairlink",
		TurnPassword:  "secret",
		TurnPort:      3478,
	}
	require.NoError(t, cfg.FinalizeRTCConfig())

	var out rtcConfig
	require.NoError(t, json.Unmarshal([]byte(cfg.RTCConfigJSON), &out))
	require.Len(t, out.IceServers, 2)
	assert.Equal(t, "stun:stun.l.google.com:19302", out.IceServers[0].URLs)
	assert.Equal(t, "turn:localhost:3478", out.IceServers[1].URLs)
	assert.Equal(t, "pairlink", out.IceServers[1].Username)
	assert.Equal(t, "secret", out.IceServers[1].Credential)
}

func TestFinalizeRTCConfig_skipsAutoTurnWhenManualTurnPresent(t *testing.T) {
	cfg := &Config{
		STUNServers: "stun.l.google.com:19302",
		RTCConfigJSON: `{"iceServers":[{"urls":"turn:custom.example.com:3478","username":"u","credential":"p"}]}`,
		TurnEnabled:  true,
		TurnPassword: "secret",
	}
	require.NoError(t, cfg.FinalizeRTCConfig())

	var out rtcConfig
	require.NoError(t, json.Unmarshal([]byte(cfg.RTCConfigJSON), &out))
	require.Len(t, out.IceServers, 2)
	assert.Equal(t, "turn:custom.example.com:3478", out.IceServers[1].URLs)
}

func TestFinalizeRTCConfig_turnDisabled(t *testing.T) {
	cfg := &Config{
		STUNServers:   "stun.l.google.com:19302",
		RTCConfigJSON: `{"iceServers":[]}`,
		TurnEnabled:   false,
		TurnPassword:  "secret",
	}
	require.NoError(t, cfg.FinalizeRTCConfig())

	var out rtcConfig
	require.NoError(t, json.Unmarshal([]byte(cfg.RTCConfigJSON), &out))
	require.Len(t, out.IceServers, 1)
}
