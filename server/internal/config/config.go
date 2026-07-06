package config

import (
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/kelseyhightower/envconfig"
)

// Config holds all server configuration loaded from environment variables.
type Config struct {
	Port      int    `envconfig:"PORT" default:"8080"`
	PublicURL string `envconfig:"PUBLIC_URL" default:"http://localhost:8080"`
	LogLevel  string `envconfig:"LOG_LEVEL" default:"info"`

	DisableAuth   bool   `envconfig:"DISABLE_AUTH" default:"false"`
	JWTSecret     string `envconfig:"JWT_SECRET"`
	JWTExpire     string `envconfig:"JWT_EXPIRE" default:"24h"`
	PairlinkUsers string `envconfig:"PAIRLINK_USERS"`

	OIDCEnabled              bool   `envconfig:"OIDC_ENABLED" default:"false"`
	OIDCIssuer               string `envconfig:"OIDC_ISSUER"`
	OIDCClientID             string `envconfig:"OIDC_CLIENT_ID"`
	OIDCClientSecret         string `envconfig:"OIDC_CLIENT_SECRET"`
	OIDCRedirectURL          string `envconfig:"OIDC_REDIRECT_URL"`
	OIDCAllowEmailDomains    string `envconfig:"OIDC_ALLOW_EMAIL_DOMAINS"`
	OIDCAllowEmails          string `envconfig:"OIDC_ALLOW_EMAILS"`
	OIDCAllowGroups          string `envconfig:"OIDC_ALLOW_GROUPS"`
	OIDCGroupsClaim          string `envconfig:"OIDC_GROUPS_CLAIM" default:"groups"`
	OIDCRequireEmailVerified bool   `envconfig:"OIDC_REQUIRE_EMAIL_VERIFIED" default:"false"`

	RTCConfigJSON string `envconfig:"RTC_CONFIG" default:"{\"iceServers\":[{\"urls\":\"stun:stun.l.google.com:19302\"}]}"`
	WSFallback    bool   `envconfig:"WS_FALLBACK" default:"true"`
	ICETimeoutSec int    `envconfig:"ICE_TIMEOUT_SEC" default:"15"`

	RoomCodeTTL    string `envconfig:"ROOM_CODE_TTL" default:"30m"`
	RoomCodeLength int    `envconfig:"ROOM_CODE_LENGTH" default:"5"`
	JoinRateLimit        int    `envconfig:"JOIN_RATE_LIMIT" default:"10"`
	LookupRateLimit      int    `envconfig:"LOOKUP_RATE_LIMIT" default:"30"`
	WSConnectRateLimit   int    `envconfig:"WS_CONNECT_RATE_LIMIT" default:"30"`
	TrustedProxyCIDRs    string `envconfig:"TRUSTED_PROXY_CIDRS"`
	TrustedProxyNets     []*net.IPNet `envconfig:"-"`

	AutoAcceptFiles   bool   `envconfig:"AUTO_ACCEPT_FILES" default:"true"`
	DefaultMaskOnSend bool   `envconfig:"DEFAULT_MASK_ON_SEND" default:"false"`
	DefaultTheme      string `envconfig:"DEFAULT_THEME" default:"dark"`
	DefaultLocale     string `envconfig:"DEFAULT_LOCALE" default:"zh-CN"`
	SupportedLocales  string `envconfig:"SUPPORTED_LOCALES" default:"zh-CN,en,zh-TW,ja,ko"`

	FileMaxSizeBytes      int64 `envconfig:"FILE_MAX_SIZE_BYTES" default:"5368709120"`
	MessageMaxLength      int   `envconfig:"MESSAGE_MAX_LENGTH" default:"65536"`
	ResumeTransferEnabled bool  `envconfig:"RESUME_TRANSFER_ENABLED" default:"true"`

	SecurityHeaders   bool `envconfig:"SECURITY_HEADERS" default:"true"`
	LoginRateLimit    int  `envconfig:"LOGIN_RATE_LIMIT" default:"10"`
	WSMaxMessageBytes int  `envconfig:"WS_MAX_MESSAGE_BYTES" default:"1048576"`
	RateLimitPerIP    int  `envconfig:"RATE_LIMIT_PER_IP" default:"100"`

	EphemeralJWTSecret bool `envconfig:"-"`
}

// PublicSettings is exposed via GET /api/config settings block.
type PublicSettings struct {
	AutoAcceptFiles       bool     `json:"autoAcceptFiles"`
	DefaultMaskOnSend     bool     `json:"defaultMaskOnSend"`
	DefaultTheme          string   `json:"defaultTheme"`
	DefaultLocale         string   `json:"defaultLocale"`
	SupportedLocales      []string `json:"supportedLocales"`
	RoomCodeLength        int      `json:"roomCodeLength"`
	ICETimeoutSec         int      `json:"iceTimeoutSec"`
	FileMaxSizeBytes      int64    `json:"fileMaxSizeBytes"`
	MessageMaxLength      int      `json:"messageMaxLength"`
	ResumeTransferEnabled bool     `json:"resumeTransferEnabled"`
}

// PublicConfig is the safe subset returned by GET /api/config.
type PublicConfig struct {
	PublicURL    string          `json:"publicUrl"`
	DisableAuth  bool            `json:"disableAuth"`
	OIDCEnabled  bool            `json:"oidcEnabled"`
	WSFallback   bool            `json:"wsFallback"`
	RTCConfig    json.RawMessage `json:"rtcConfig"`
	Settings     PublicSettings  `json:"settings"`
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	if err := ApplyDefaults(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// JWTExpireDuration parses JWT_EXPIRE.
func (c *Config) JWTExpireDuration() (time.Duration, error) {
	return time.ParseDuration(c.JWTExpire)
}

// RoomCodeTTLDuration parses ROOM_CODE_TTL.
func (c *Config) RoomCodeTTLDuration() (time.Duration, error) {
	return time.ParseDuration(c.RoomCodeTTL)
}

// ParseAllowList splits a comma-separated allow list.
func ParseAllowList(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// HasOIDCAllowRules reports whether any OIDC allow rule is configured.
func (c *Config) HasOIDCAllowRules() bool {
	return len(ParseAllowList(c.OIDCAllowEmailDomains)) > 0 ||
		len(ParseAllowList(c.OIDCAllowEmails)) > 0 ||
		len(ParseAllowList(c.OIDCAllowGroups)) > 0
}

// ParsedRTCConfig validates and returns RTC_CONFIG JSON.
func (c *Config) ParsedRTCConfig() (json.RawMessage, error) {
	var v any
	if err := json.Unmarshal([]byte(c.RTCConfigJSON), &v); err != nil {
		return nil, fmt.Errorf("invalid RTC_CONFIG: %w", err)
	}
	return json.RawMessage(c.RTCConfigJSON), nil
}

// ToPublicConfig maps to the public API response.
func (c *Config) ToPublicConfig() (PublicConfig, error) {
	rtc, err := c.ParsedRTCConfig()
	if err != nil {
		return PublicConfig{}, err
	}
	return PublicConfig{
		PublicURL:   c.PublicURL,
		DisableAuth: c.DisableAuth,
		OIDCEnabled: c.OIDCEnabled,
		WSFallback:  c.WSFallback,
		RTCConfig:   rtc,
		Settings: PublicSettings{
			AutoAcceptFiles:       c.AutoAcceptFiles,
			DefaultMaskOnSend:     c.DefaultMaskOnSend,
			DefaultTheme:          c.DefaultTheme,
			DefaultLocale:         c.DefaultLocale,
			SupportedLocales:      ParseAllowList(c.SupportedLocales),
			RoomCodeLength:        c.RoomCodeLength,
			ICETimeoutSec:         c.ICETimeoutSec,
			FileMaxSizeBytes:      c.FileMaxSizeBytes,
			MessageMaxLength:      c.MessageMaxLength,
			ResumeTransferEnabled: c.ResumeTransferEnabled,
		},
	}, nil
}

// HasLocalUsers reports whether PAIRLINK_USERS is non-empty.
func (c *Config) HasLocalUsers() bool {
	return strings.TrimSpace(c.PairlinkUsers) != ""
}

// HasOIDCConfigured reports whether OIDC is fully configured.
func (c *Config) HasOIDCConfigured() bool {
	return c.OIDCEnabled &&
		strings.TrimSpace(c.OIDCIssuer) != "" &&
		strings.TrimSpace(c.OIDCClientID) != "" &&
		strings.TrimSpace(c.OIDCClientSecret) != "" &&
		strings.TrimSpace(c.OIDCRedirectURL) != ""
}
