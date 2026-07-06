package config

import (
	"encoding/json"
	"fmt"
	"strings"
)

// DefaultSTUNServers is the comma-separated default STUN list (international + China-accessible).
const DefaultSTUNServers = "stun.l.google.com:19302,stun1.l.google.com:19302,stun.miwifi.com:3478,stun.qq.com:3478"

type iceServer struct {
	URLs           any    `json:"urls"`
	Username       string `json:"username,omitempty"`
	Credential     string `json:"credential,omitempty"`
	CredentialType string `json:"credentialType,omitempty"`
}

type rtcConfig struct {
	IceServers []iceServer `json:"iceServers"`
}

// ParseStunServerList splits STUN_SERVERS and normalizes each entry to a stun: URL.
func ParseStunServerList(raw string) []string {
	parts := ParseAllowList(raw)
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if u := normalizeStunURL(p); u != "" {
			out = append(out, u)
		}
	}
	return out
}

func normalizeStunURL(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	lower := strings.ToLower(s)
	if strings.HasPrefix(lower, "stun:") || strings.HasPrefix(lower, "stuns:") {
		return s
	}
	return "stun:" + s
}

func iceServerURLs(urls any) []string {
	switch v := urls.(type) {
	case string:
		if strings.TrimSpace(v) != "" {
			return []string{v}
		}
	case []any:
		out := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
				out = append(out, s)
			}
		}
		return out
	case []string:
		out := make([]string, 0, len(v))
		for _, s := range v {
			if strings.TrimSpace(s) != "" {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

func isTurnIceServer(s iceServer) bool {
	for _, u := range iceServerURLs(s.URLs) {
		lower := strings.ToLower(u)
		if strings.HasPrefix(lower, "turn:") || strings.HasPrefix(lower, "turns:") {
			return true
		}
	}
	return false
}

func buildStunIceServers(urls []string) []iceServer {
	if len(urls) == 0 {
		return nil
	}
	servers := make([]iceServer, 0, len(urls))
	for _, u := range urls {
		servers = append(servers, iceServer{URLs: u})
	}
	return servers
}

// FinalizeRTCConfig merges STUN_SERVERS with TURN (and other non-STUN) entries from RTC_CONFIG.
func (c *Config) FinalizeRTCConfig() error {
	stunURLs := ParseStunServerList(c.STUNServers)

	var parsed rtcConfig
	if err := json.Unmarshal([]byte(c.RTCConfigJSON), &parsed); err != nil {
		return fmt.Errorf("invalid RTC_CONFIG: %w", err)
	}

	turnServers := make([]iceServer, 0, len(parsed.IceServers))
	for _, s := range parsed.IceServers {
		if isTurnIceServer(s) {
			turnServers = append(turnServers, s)
		}
	}
	if len(turnServers) == 0 {
		if auto := c.buildAutoTurnIceServer(); auto != nil {
			turnServers = append(turnServers, *auto)
		}
	}

	merged := rtcConfig{
		IceServers: append(buildStunIceServers(stunURLs), turnServers...),
	}
	out, err := json.Marshal(merged)
	if err != nil {
		return fmt.Errorf("marshal RTC config: %w", err)
	}
	c.RTCConfigJSON = string(out)
	return nil
}

// ParsedRTCConfig validates and returns the finalized RTC_CONFIG JSON.
func (c *Config) ParsedRTCConfig() (json.RawMessage, error) {
	var v any
	if err := json.Unmarshal([]byte(c.RTCConfigJSON), &v); err != nil {
		return nil, fmt.Errorf("invalid RTC_CONFIG: %w", err)
	}
	return json.RawMessage(c.RTCConfigJSON), nil
}
