package clientip

import (
	"net"
	"net/http"
	"strings"
)

// ParseCIDRs splits a comma-separated list of CIDR strings.
func ParseCIDRs(raw string) ([]*net.IPNet, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	parts := strings.Split(raw, ",")
	out := make([]*net.IPNet, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		_, network, err := net.ParseCIDR(part)
		if err != nil {
			return nil, err
		}
		out = append(out, network)
	}
	return out, nil
}

// FromRequest returns the client IP used for rate limiting.
// When the direct remote address falls within trustedProxyNets, the left-most
// X-Forwarded-For or X-Real-IP value is used instead.
func FromRequest(r *http.Request, trustedProxyNets []*net.IPNet) string {
	remote := remoteHost(r.RemoteAddr)
	if len(trustedProxyNets) == 0 || !isTrustedProxy(remote, trustedProxyNets) {
		return remote
	}
	if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); ip != "" {
		return stripPort(ip)
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		first := xff
		if i := strings.Index(xff, ","); i >= 0 {
			first = xff[:i]
		}
		return stripPort(strings.TrimSpace(first))
	}
	return remote
}

func remoteHost(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return remoteAddr
	}
	return host
}

func stripPort(ip string) string {
	if host, _, err := net.SplitHostPort(ip); err == nil {
		return host
	}
	return ip
}

func isTrustedProxy(remote string, nets []*net.IPNet) bool {
	ip := net.ParseIP(remote)
	if ip == nil {
		return false
	}
	for _, n := range nets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}
