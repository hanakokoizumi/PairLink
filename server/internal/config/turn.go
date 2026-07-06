package config

import (
	"fmt"
	"net/url"
	"strings"
)

// ResolveTurnHost returns the hostname browsers should use for TURN.
func (c *Config) ResolveTurnHost() string {
	if h := strings.TrimSpace(c.TurnHost); h != "" {
		return h
	}
	u, err := url.Parse(c.PublicURL)
	if err == nil {
		if host := u.Hostname(); host != "" {
			return host
		}
	}
	return "localhost"
}

func (c *Config) buildAutoTurnIceServer() *iceServer {
	if !c.TurnEnabled {
		return nil
	}
	if strings.TrimSpace(c.TurnPassword) == "" {
		return nil
	}
	user := strings.TrimSpace(c.TurnUser)
	if user == "" {
		user = "pairlink"
	}
	port := c.TurnPort
	if port <= 0 {
		port = 3478
	}
	host := c.ResolveTurnHost()
	return &iceServer{
		URLs:       fmt.Sprintf("turn:%s:%d", host, port),
		Username:   user,
		Credential: c.TurnPassword,
	}
}
