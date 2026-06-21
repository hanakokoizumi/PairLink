package auth

import (
	"errors"
	"fmt"
	"strings"
)

var ErrOIDCForbidden = errors.New("oidc forbidden")

// OIDCPolicy enforces OIDC login allow rules from environment variables.
type OIDCPolicy struct {
	AllowEmailDomains    []string
	AllowEmails          []string
	AllowGroups          []string
	GroupsClaim          string
	RequireEmailVerified bool
}

// NewOIDCPolicy builds a policy from config slices.
func NewOIDCPolicy(domains, emails, groups []string, groupsClaim string, requireVerified bool) *OIDCPolicy {
	if groupsClaim == "" {
		groupsClaim = "groups"
	}
	return &OIDCPolicy{
		AllowEmailDomains:    normalizeList(domains),
		AllowEmails:          normalizeList(emails),
		AllowGroups:          normalizeList(groups),
		GroupsClaim:          groupsClaim,
		RequireEmailVerified: requireVerified,
	}
}

func normalizeList(items []string) []string {
	out := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(strings.ToLower(item))
		if item != "" {
			out = append(out, item)
		}
	}
	return out
}

// HasAllowRules reports whether any allow list is configured.
func (p *OIDCPolicy) HasAllowRules() bool {
	return len(p.AllowEmailDomains) > 0 || len(p.AllowEmails) > 0 || len(p.AllowGroups) > 0
}

// Allow checks OIDC claims against configured rules.
func (p *OIDCPolicy) Allow(claims map[string]any) error {
	if p.RequireEmailVerified {
		if !boolClaim(claims["email_verified"]) {
			return ErrOIDCForbidden
		}
	}

	if !p.HasAllowRules() {
		return nil
	}

	email, _ := claims["email"].(string)
	email = strings.ToLower(strings.TrimSpace(email))

	if email != "" {
		for _, allowed := range p.AllowEmails {
			if email == allowed {
				return nil
			}
		}
		if at := strings.LastIndex(email, "@"); at >= 0 {
			domain := email[at+1:]
			for _, allowed := range p.AllowEmailDomains {
				if domain == allowed {
					return nil
				}
			}
		}
	}

	userGroups := extractGroups(claims[p.GroupsClaim])
	for _, g := range userGroups {
		for _, allowed := range p.AllowGroups {
			if g == allowed {
				return nil
			}
		}
	}

	return ErrOIDCForbidden
}

func boolClaim(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return strings.EqualFold(t, "true")
	default:
		return false
	}
}

func extractGroups(v any) []string {
	switch t := v.(type) {
	case string:
		return normalizeList([]string{t})
	case []string:
		return normalizeList(t)
	case []any:
		out := make([]string, 0, len(t))
		for _, item := range t {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return normalizeList(out)
	default:
		return nil
	}
}

// UsernameFromClaims picks a display username from OIDC claims.
func UsernameFromClaims(claims map[string]any) string {
	if email, ok := claims["email"].(string); ok && email != "" {
		return email
	}
	if name, ok := claims["preferred_username"].(string); ok && name != "" {
		return name
	}
	if sub, ok := claims["sub"].(string); ok {
		return sub
	}
	return "oidc-user"
}

// SubjectFromClaims returns the OIDC subject.
func SubjectFromClaims(claims map[string]any) (string, error) {
	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return "", fmt.Errorf("missing sub claim")
	}
	return sub, nil
}
