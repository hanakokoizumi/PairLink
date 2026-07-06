package ws

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hanakokoizumi/pairlink/server/internal/config"
	"github.com/hanakokoizumi/pairlink/server/internal/room"
)

func TestHandler_wsConfigIncludesConnectionMode(t *testing.T) {
	mgr := room.NewManager(30*time.Minute, 5)
	defer mgr.Stop()

	r, err := mgr.Create("owner")
	require.NoError(t, err)
	r.SetConnectionMode(room.ModeRelay)

	host := &room.Peer{
		ID:       "host-1",
		ConnID:   "c-host",
		Role:     room.RoleHost,
		JoinedAt: time.Now(),
	}
	require.NoError(t, mgr.AddPeer(r.ID, host))

	hub := NewHub(mgr)
	cfg := &config.Config{WSFallback: true, WSMaxMessageBytes: 65536}
	h := &Handler{hub: hub, rooms: mgr, cfg: cfg}

	hostClient := &Client{
		connID: "c-host",
		hub:    hub,
		send:   make(chan []byte, 4),
		peerID: host.ID,
		roomID: r.ID,
		role:   string(room.RoleHost),
	}
	hub.Register(hostClient)

	require.NoError(t, h.sendHostWsConfig(hostClient, r, host.ID))

	select {
	case got := <-hostClient.send:
		var env Envelope
		require.NoError(t, json.Unmarshal(got, &env))
		assert.Equal(t, "ws-config", env.Type)
		payload, err := json.Marshal(env.Payload)
		require.NoError(t, err)
		var wsCfg WSConfigPayload
		require.NoError(t, json.Unmarshal(payload, &wsCfg))
		assert.Equal(t, "relay", wsCfg.ConnectionMode)
	default:
		t.Fatal("expected ws-config")
	}
}

func TestHandler_useRelayPersistsRoomMode(t *testing.T) {
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

	require.NoError(t, h.handleUseRelay(hostClient, Envelope{Type: "use-relay"}))

	assert.Equal(t, room.ModeRelay, r.ConnectionModeOrDefault())

	select {
	case got := <-guestClient.send:
		var env Envelope
		require.NoError(t, json.Unmarshal(got, &env))
		assert.Equal(t, "use-relay", env.Type)
	default:
		t.Fatal("expected use-relay forwarded to guest")
	}
}

func TestHandler_useWebRTCPersistsRoomMode(t *testing.T) {
	mgr := room.NewManager(30*time.Minute, 5)
	defer mgr.Stop()

	r, err := mgr.Create("owner")
	require.NoError(t, err)
	r.SetConnectionMode(room.ModeRelay)

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

	guestClient := &Client{
		connID: "c-guest",
		hub:    hub,
		send:   make(chan []byte, 4),
		peerID: guest.ID,
		roomID: r.ID,
		role:   string(room.RoleGuest),
	}
	hostClient := &Client{
		connID: "c-host",
		hub:    hub,
		send:   make(chan []byte, 4),
		peerID: host.ID,
		roomID: r.ID,
		role:   string(room.RoleHost),
	}
	hub.Register(hostClient)
	hub.Register(guestClient)

	require.NoError(t, h.handleUseWebRTC(guestClient, Envelope{Type: "use-webrtc"}))

	assert.Equal(t, room.ModeWebRTC, r.ConnectionModeOrDefault())

	select {
	case got := <-hostClient.send:
		var env Envelope
		require.NoError(t, json.Unmarshal(got, &env))
		assert.Equal(t, "use-webrtc", env.Type)
	default:
		t.Fatal("expected use-webrtc forwarded to host")
	}
}
