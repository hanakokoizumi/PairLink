package ws

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hanakokoizumi/pairlink/server/internal/room"
)

func TestHandler_handleLeaveRoom_notifiesPeer(t *testing.T) {
	mgr := room.NewManager(30*time.Minute, 5)
	defer mgr.Stop()

	r, err := mgr.Create("owner")
	require.NoError(t, err)

	host := &room.Peer{
		ID:       "host-1",
		ConnID:   "c-host",
		Role:     room.RoleHost,
		JoinedAt: time.Now(),
	}
	guest := &room.Peer{
		ID:       "guest-1",
		ConnID:   "c-guest",
		Role:     room.RoleGuest,
		JoinedAt: time.Now(),
	}
	require.NoError(t, mgr.AddPeer(r.ID, host))
	require.NoError(t, mgr.AddPeer(r.ID, guest))

	hub := NewHub(mgr)
	h := &Handler{hub: hub, rooms: mgr}

	hostClient := &Client{
		connID: "c-host",
		hub:    hub,
		send:   make(chan []byte, 4),
		peerID: host.ID,
		roomID: r.ID,
		role:   string(room.RoleHost),
	}
	guestClient := &Client{
		connID: "c-guest",
		hub:    hub,
		send:   make(chan []byte, 4),
		peerID: guest.ID,
		roomID: r.ID,
		role:   string(room.RoleGuest),
	}
	hub.Register(hostClient)
	hub.Register(guestClient)

	require.NoError(t, h.handleLeaveRoom(hostClient))

	select {
	case got := <-guestClient.send:
		var env Envelope
		require.NoError(t, json.Unmarshal(got, &env))
		assert.Equal(t, "peer-left", env.Type)
	default:
		t.Fatal("expected peer-left broadcast to guest")
	}

	_, _, ok := mgr.GetRoomByConnID("c-host")
	assert.False(t, ok)
}
