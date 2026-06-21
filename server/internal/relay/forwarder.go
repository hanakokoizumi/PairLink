package relay

import (
	"github.com/hanakokoizumi/pairlink/server/internal/room"
)

// Forwarder relays opaque chunks between room peers.
type Forwarder struct{}

// NewForwarder creates a relay forwarder.
func NewForwarder() *Forwarder {
	return &Forwarder{}
}

// Forward finds the other peer in the room for relay forwarding.
func (f *Forwarder) Forward(r *room.Room, fromPeerID string) (*room.Peer, bool) {
	return r.OtherPeer(fromPeerID)
}
