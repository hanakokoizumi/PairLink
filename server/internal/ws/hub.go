package ws

import (
	"encoding/json"
	"sync"

	"github.com/hanakokoizumi/pairlink/server/internal/room"
)

// Hub tracks active WebSocket clients and routes messages.
type Hub struct {
	mu      sync.RWMutex
	clients map[string]*Client
	rooms   roomLookup
}

type roomLookup interface {
	GetRoomByConnID(connID string) (*room.Room, *room.Peer, bool)
	RemovePeer(connID string) (*room.Room, *room.Peer, bool)
}

// NewHub creates a WebSocket hub.
func NewHub(rooms roomLookup) *Hub {
	return &Hub{
		clients: make(map[string]*Client),
		rooms:   rooms,
	}
}

// Register adds a client to the hub.
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c.connID] = c
}

// Unregister removes a client and broadcasts peer-left when applicable.
func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	delete(h.clients, c.connID)
	h.mu.Unlock()

	if r, peer, ok := h.rooms.RemovePeer(c.connID); ok {
		payload, _ := json.Marshal(Envelope{
			Type: "peer-left",
			Payload: PeerLeftPayload{
				PeerID: peer.ID,
				Role:   string(peer.Role),
			},
		})
		h.BroadcastToRoom(r.ID, payload, c.connID)
	}
}

// GetClient returns a client by connection ID.
func (h *Hub) GetClient(connID string) (*Client, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	c, ok := h.clients[connID]
	return c, ok
}

// BroadcastToRoom sends a message to all peers in a room except excludeConnID.
func (h *Hub) BroadcastToRoom(roomID string, msg []byte, excludeConnID string) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, c := range h.clients {
		if c.RoomID() == roomID && c.ConnID() != excludeConnID {
			c.TrySend(msg)
		}
	}
}

// SendToPeer sends a message to a peer by peer ID.
func (h *Hub) SendToPeer(peerID string, msg []byte) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, c := range h.clients {
		if c.PeerID() == peerID {
			return c.TrySend(msg)
		}
	}
	return false
}

// SendToConn sends a message to a specific connection.
func (h *Hub) SendToConn(connID string, msg []byte) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if c, ok := h.clients[connID]; ok {
		return c.TrySend(msg)
	}
	return false
}
