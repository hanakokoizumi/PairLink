package room

import (
	"sync"
	"time"
)

// PeerRole identifies host or guest in a room.
type PeerRole string

const (
	RoleHost  PeerRole = "host"
	RoleGuest PeerRole = "guest"
)

// ConnectionMode is the transport mode for a room session.
type ConnectionMode string

const (
	ModeWebRTC ConnectionMode = "webrtc"
	ModeRelay  ConnectionMode = "relay"
)

// Room is an in-memory session identified by ID and join code.
type Room struct {
	ID         string
	Code       string
	Secret     string
	OwnerID    string
	CreatedAt  time.Time
	ExpiresAt  time.Time
	Peers          map[string]*Peer
	ConnectionMode ConnectionMode
	mu             sync.RWMutex
}

// Peer represents a connected participant.
type Peer struct {
	ID       string
	ConnID   string
	Role     PeerRole
	JoinedAt time.Time
}

// PeerCount returns the number of peers in the room.
func (r *Room) PeerCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Peers)
}

// IsExpired reports whether the room TTL has passed.
func (r *Room) IsExpired(now time.Time) bool {
	return now.After(r.ExpiresAt) || now.Equal(r.ExpiresAt)
}

// FindPeerByConnID returns a peer by WebSocket connection ID.
func (r *Room) FindPeerByConnID(connID string) (*Peer, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, p := range r.Peers {
		if p.ConnID == connID {
			return p, true
		}
	}
	return nil, false
}

// HasConnectedHost reports whether another connection already hosts the room.
func (r *Room) HasConnectedHost(excludeConnID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, p := range r.Peers {
		if p.Role == RoleHost && p.ConnID != excludeConnID {
			return true
		}
	}
	return false
}

// ConnectionModeOrDefault returns the room transport mode, defaulting to WebRTC.
func (r *Room) ConnectionModeOrDefault() ConnectionMode {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.ConnectionMode == "" {
		return ModeWebRTC
	}
	return r.ConnectionMode
}

// SetConnectionMode stores the authoritative transport mode for the room.
func (r *Room) SetConnectionMode(mode ConnectionMode) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.ConnectionMode = mode
}

// OtherPeer returns the peer that is not the given peer ID.
func (r *Room) OtherPeer(peerID string) (*Peer, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for id, p := range r.Peers {
		if id != peerID {
			return p, true
		}
	}
	return nil, false
}
