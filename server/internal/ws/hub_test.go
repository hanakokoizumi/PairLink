package ws

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hanakokoizumi/pairlink/server/internal/room"
)

type stubRoomLookup struct {
	rooms map[string]*room.Room
	peers map[string]*room.Peer
}

func (s *stubRoomLookup) GetRoomByConnID(connID string) (*room.Room, *room.Peer, bool) {
	for _, r := range s.rooms {
		if p, ok := r.FindPeerByConnID(connID); ok {
			return r, p, true
		}
	}
	return nil, nil, false
}

func (s *stubRoomLookup) RemovePeer(connID string) (*room.Room, *room.Peer, bool) {
	for _, r := range s.rooms {
		for id, p := range r.Peers {
			if p.ConnID == connID {
				delete(r.Peers, id)
				return r, p, true
			}
		}
	}
	return nil, nil, false
}

func TestHub_BroadcastAndSend(t *testing.T) {
	lookup := &stubRoomLookup{rooms: make(map[string]*room.Room)}
	hub := NewHub(lookup)

	c1 := &Client{connID: "c1", hub: hub, send: make(chan []byte, 4), roomID: "room-1", peerID: "p1"}
	c2 := &Client{connID: "c2", hub: hub, send: make(chan []byte, 4), roomID: "room-1", peerID: "p2"}
	hub.Register(c1)
	hub.Register(c2)

	msg := []byte(`{"type":"signal"}`)
	hub.BroadcastToRoom("room-1", msg, "c1")

	select {
	case got := <-c2.send:
		assert.JSONEq(t, string(msg), string(got))
	default:
		t.Fatal("expected message on c2")
	}

	select {
	case <-c1.send:
		t.Fatal("c1 should be excluded")
	default:
	}

	ok := hub.SendToPeer("p2", []byte(`{"type":"ping"}`))
	assert.True(t, ok)
	select {
	case got := <-c2.send:
		assert.Contains(t, string(got), "ping")
	default:
		t.Fatal("expected direct send")
	}
}

func TestHub_UnregisterPeerLeft(t *testing.T) {
	r := &room.Room{
		ID:    "room-1",
		Peers: make(map[string]*room.Peer),
	}
	r.Peers["p1"] = &room.Peer{ID: "p1", ConnID: "c1", Role: room.RoleHost}
	r.Peers["p2"] = &room.Peer{ID: "p2", ConnID: "c2", Role: room.RoleGuest}

	lookup := &stubRoomLookup{rooms: map[string]*room.Room{"room-1": r}}
	hub := NewHub(lookup)

	c2 := &Client{connID: "c2", hub: hub, send: make(chan []byte, 4), roomID: "room-1", peerID: "p2"}
	hub.Register(c2)

	hub.Unregister(&Client{connID: "c1", hub: hub})

	select {
	case got := <-c2.send:
		var env Envelope
		require.NoError(t, json.Unmarshal(got, &env))
		assert.Equal(t, "peer-left", env.Type)
	default:
		t.Fatal("expected peer-left broadcast")
	}
}
