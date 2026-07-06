package config

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"strings"

	"github.com/hanakokoizumi/pairlink/server/internal/clientip"
)

// ApplyDefaults fills missing values and infers zero-config behavior.
func ApplyDefaults(cfg *Config) error {
	if cfg.JWTSecret == "" {
		secret, err := generateJWTSecret()
		if err != nil {
			return fmt.Errorf("generate JWT secret: %w", err)
		}
		cfg.JWTSecret = secret
		cfg.EphemeralJWTSecret = true
	}

	if !cfg.DisableAuth {
		hasUsers := cfg.HasLocalUsers()
		hasOIDC := cfg.HasOIDCConfigured()
		if !hasUsers && !hasOIDC {
			cfg.DisableAuth = true
		}
	}

	if cfg.PublicURL == "" {
		port := cfg.Port
		if port == 0 {
			port = 8080
		}
		cfg.PublicURL = fmt.Sprintf("http://localhost:%d", port)
	}

	if strings.TrimSpace(cfg.STUNServers) == "" {
		cfg.STUNServers = DefaultSTUNServers
	}
	if err := cfg.FinalizeRTCConfig(); err != nil {
		return err
	}

	if _, err := cfg.ParsedRTCConfig(); err != nil {
		return err
	}

	if _, err := cfg.JWTExpireDuration(); err != nil {
		return fmt.Errorf("invalid JWT_EXPIRE: %w", err)
	}

	if _, err := cfg.RoomCodeTTLDuration(); err != nil {
		return fmt.Errorf("invalid ROOM_CODE_TTL: %w", err)
	}

	if cfg.TrustedProxyCIDRs != "" {
		nets, err := clientip.ParseCIDRs(cfg.TrustedProxyCIDRs)
		if err != nil {
			return fmt.Errorf("invalid TRUSTED_PROXY_CIDRS: %w", err)
		}
		cfg.TrustedProxyNets = nets
	}

	return nil
}

func generateJWTSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// ShouldLoadDotenv reports whether main should attempt godotenv.Load.
func ShouldLoadDotenv() bool {
	return os.Getenv("PAIRLINK_LOAD_DOTENV") != "false"
}
