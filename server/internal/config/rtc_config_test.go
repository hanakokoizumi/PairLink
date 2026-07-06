package config

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseStunServerList(t *testing.T) {
	urls := ParseStunServerList("stun.l.google.com:19302, stun:stun.qq.com:3478")
	assert.Equal(t, []string{
		"stun:stun.l.google.com:19302",
		"stun:stun.qq.com:3478",
	}, urls)
}

func TestFinalizeRTCConfig_mergesStunAndTurn(t *testing.T) {
	cfg := &Config{
		STUNServers: "stun.l.google.com:19302,stun.miwifi.com:3478",
		RTCConfigJSON: `{
			"iceServers": [
				{"urls":"stun:stun.old.example.com:3478"},
				{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}
			]
		}`,
	}
	require.NoError(t, cfg.FinalizeRTCConfig())

	var out rtcConfig
	require.NoError(t, json.Unmarshal([]byte(cfg.RTCConfigJSON), &out))
	require.Len(t, out.IceServers, 3)

	assert.Equal(t, "stun:stun.l.google.com:19302", out.IceServers[0].URLs)
	assert.Equal(t, "stun:stun.miwifi.com:3478", out.IceServers[1].URLs)
	assert.Equal(t, "turn:turn.example.com:3478", out.IceServers[2].URLs)
	assert.Equal(t, "u", out.IceServers[2].Username)
}

func TestApplyDefaults_usesDefaultStunServers(t *testing.T) {
	cfg := &Config{
		PublicURL:     "http://localhost:8080",
		JWTSecret:     "test",
		JWTExpire:     "24h",
		RoomCodeTTL:   "30m",
		RTCConfigJSON: `{"iceServers":[]}`,
		DisableAuth:   true,
	}
	require.NoError(t, ApplyDefaults(cfg))

	urls := ParseStunServerList(cfg.STUNServers)
	assert.Contains(t, urls, "stun:stun.l.google.com:19302")
	assert.Contains(t, urls, "stun:stun.miwifi.com:3478")
	assert.Contains(t, urls, "stun:stun.qq.com:3478")

	pub, err := cfg.ToPublicConfig()
	require.NoError(t, err)

	var rtc rtcConfig
	require.NoError(t, json.Unmarshal(pub.RTCConfig, &rtc))
	assert.GreaterOrEqual(t, len(rtc.IceServers), 4)
}

func TestFinalizeRTCConfig_customStunOnly(t *testing.T) {
	cfg := &Config{
		STUNServers:   "stun.custom.example.com:3478",
		RTCConfigJSON: `{"iceServers":[]}`,
	}
	require.NoError(t, cfg.FinalizeRTCConfig())

	var out rtcConfig
	require.NoError(t, json.Unmarshal([]byte(cfg.RTCConfigJSON), &out))
	require.Len(t, out.IceServers, 1)
	assert.Equal(t, "stun:stun.custom.example.com:3478", out.IceServers[0].URLs)
}
