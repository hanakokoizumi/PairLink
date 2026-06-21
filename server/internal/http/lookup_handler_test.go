package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hanakokoizumi/pairlink/server/internal/room"
)

func TestLookupHandler_success(t *testing.T) {
	m := room.NewManager(30 * time.Minute)
	defer m.Stop()
	created, err := m.Create("host")
	require.NoError(t, err)

	h := NewLookupHandler(m)
	req := httptest.NewRequest(http.MethodGet, "/api/rooms/lookup?code="+created.Code, nil)
	rec := httptest.NewRecorder()
	h.Lookup(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), created.ID)
}

func TestLookupHandler_invalidCode(t *testing.T) {
	h := NewLookupHandler(room.NewManager(time.Minute))
	req := httptest.NewRequest(http.MethodGet, "/api/rooms/lookup?code=abc", nil)
	rec := httptest.NewRecorder()
	h.Lookup(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestLookupHandler_roomFull(t *testing.T) {
	m := room.NewManager(30 * time.Minute)
	defer m.Stop()
	created, err := m.Create("host")
	require.NoError(t, err)
	require.NoError(t, m.AddPeer(created.ID, &room.Peer{ID: "p1", ConnID: "c1", Role: room.RoleHost, JoinedAt: time.Now()}))
	require.NoError(t, m.AddPeer(created.ID, &room.Peer{ID: "p2", ConnID: "c2", Role: room.RoleGuest, JoinedAt: time.Now()}))

	h := NewLookupHandler(m)
	req := httptest.NewRequest(http.MethodGet, "/api/rooms/lookup?code="+created.Code, nil)
	rec := httptest.NewRecorder()
	h.Lookup(rec, req)
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.Contains(t, rec.Body.String(), "room_full")
}

func TestLookupHandler_expired(t *testing.T) {
	mgr := room.NewManager(time.Millisecond)
	defer mgr.Stop()
	created, err := mgr.Create("host")
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	h := NewLookupHandler(mgr)
	req := httptest.NewRequest(http.MethodGet, "/api/rooms/lookup?code="+created.Code, nil)
	rec := httptest.NewRecorder()
	h.Lookup(rec, req)
	assert.Equal(t, http.StatusGone, rec.Code)
}
