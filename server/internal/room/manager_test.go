package room

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestManager_CreateAndFind(t *testing.T) {
	m := NewManager(30 * time.Minute)
	defer m.Stop()

	r, err := m.Create("host-peer-1")
	require.NoError(t, err)
	assert.NotEmpty(t, r.ID)
	assert.NotEmpty(t, r.Code)
	assert.NotEmpty(t, r.Secret)

	byCode, err := m.FindByCode(r.Code)
	require.NoError(t, err)
	assert.Equal(t, r.ID, byCode.ID)

	byID, err := m.FindByID(r.ID)
	require.NoError(t, err)
	assert.Equal(t, r.Code, byID.Code)
}

func TestManager_RoomFull(t *testing.T) {
	m := NewManager(30 * time.Minute)
	defer m.Stop()

	r, err := m.Create("host")
	require.NoError(t, err)

	err = m.AddPeer(r.ID, &Peer{ID: "p1", ConnID: "c1", Role: RoleHost, JoinedAt: time.Now()})
	require.NoError(t, err)
	err = m.AddPeer(r.ID, &Peer{ID: "p2", ConnID: "c2", Role: RoleGuest, JoinedAt: time.Now()})
	require.NoError(t, err)

	err = m.AddPeer(r.ID, &Peer{ID: "p3", ConnID: "c3", Role: RoleGuest, JoinedAt: time.Now()})
	assert.ErrorIs(t, err, ErrRoomFull)
}

func TestManager_Expired(t *testing.T) {
	m := &Manager{
		rooms:    make(map[string]*Room),
		codeToID: make(map[string]string),
		ttl:      time.Minute,
		now:      func() time.Time { return time.Now().Add(2 * time.Minute) },
		stopCh:   make(chan struct{}),
	}

	r := &Room{
		ID:        "room-1",
		Code:      "12345",
		ExpiresAt: time.Now().Add(-time.Minute),
		Peers:     make(map[string]*Peer),
	}
	m.rooms[r.ID] = r
	m.codeToID[r.Code] = r.ID

	_, err := m.FindByID(r.ID)
	assert.ErrorIs(t, err, ErrRoomExpired)
}

func TestManager_RemovePeer(t *testing.T) {
	m := NewManager(30 * time.Minute)
	defer m.Stop()

	r, err := m.Create("host")
	require.NoError(t, err)

	peer := &Peer{ID: "p1", ConnID: "conn-1", Role: RoleHost, JoinedAt: time.Now()}
	require.NoError(t, m.AddPeer(r.ID, peer))

	room, removed, ok := m.RemovePeer("conn-1")
	assert.True(t, ok)
	assert.Equal(t, r.ID, room.ID)
	assert.Equal(t, "p1", removed.ID)
}
