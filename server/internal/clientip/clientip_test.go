package clientip

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFromRequest_usesRemoteAddrByDefault(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "203.0.113.10:12345"
	assert.Equal(t, "203.0.113.10", FromRequest(r, nil))
}

func TestFromRequest_usesForwardedHeaderBehindTrustedProxy(t *testing.T) {
	nets, err := ParseCIDRs("127.0.0.0/8")
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "127.0.0.1:8080"
	r.Header.Set("X-Forwarded-For", "198.51.100.20, 10.0.0.1")
	assert.Equal(t, "198.51.100.20", FromRequest(r, nets))
}

func TestFromRequest_ignoresForwardedHeaderWithoutTrustedProxy(t *testing.T) {
	nets, err := ParseCIDRs("127.0.0.0/8")
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "203.0.113.10:12345"
	r.Header.Set("X-Forwarded-For", "198.51.100.20")
	assert.Equal(t, "203.0.113.10", FromRequest(r, nets))
}

func TestParseCIDRs_rejectsInvalid(t *testing.T) {
	_, err := ParseCIDRs("not-a-cidr")
	assert.Error(t, err)
}
