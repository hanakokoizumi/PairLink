package room

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

var (
	ErrRoomNotFound = errors.New("room not found")
	ErrRoomExpired  = errors.New("room expired")
	ErrRoomFull     = errors.New("room is full")
	ErrCodeConflict = errors.New("code generation conflict")
)

const maxCodeRetries = 10
const maxPeers = 2

// Manager tracks in-memory rooms keyed by ID and join code.
type Manager struct {
	mu       sync.RWMutex
	rooms    map[string]*Room
	codeToID map[string]string
	ttl      time.Duration
	now      func() time.Time
	stopCh   chan struct{}
}

// NewManager creates a room manager with the given TTL.
func NewManager(ttl time.Duration) *Manager {
	m := &Manager{
		rooms:    make(map[string]*Room),
		codeToID: make(map[string]string),
		ttl:      ttl,
		now:      time.Now,
		stopCh:   make(chan struct{}),
	}
	go m.cleanupLoop()
	return m
}

// Stop terminates the background cleanup goroutine.
func (m *Manager) Stop() {
	close(m.stopCh)
}

func (m *Manager) cleanupLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			m.CleanupExpired()
		case <-m.stopCh:
			return
		}
	}
}

// CleanupExpired removes expired rooms.
func (m *Manager) CleanupExpired() {
	now := m.now()
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, r := range m.rooms {
		if r.IsExpired(now) {
			delete(m.rooms, id)
			delete(m.codeToID, r.Code)
		}
	}
}

// Create allocates a new room for the given host peer ID.
func (m *Manager) Create(hostPeerID string) (*Room, error) {
	now := m.now()
	var code string
	var err error

	m.mu.Lock()
	defer m.mu.Unlock()

	for i := 0; i < maxCodeRetries; i++ {
		code, err = GenerateCode()
		if err != nil {
			return nil, err
		}
		if _, exists := m.codeToID[code]; !exists {
			break
		}
		if i == maxCodeRetries-1 {
			return nil, ErrCodeConflict
		}
	}

	secret, err := generateSecret()
	if err != nil {
		return nil, err
	}

	roomID := uuid.NewString()
	r := &Room{
		ID:         roomID,
		Code:       code,
		Secret:     secret,
		HostPeerID: hostPeerID,
		CreatedAt:  now,
		ExpiresAt:  now.Add(m.ttl),
		Peers:      make(map[string]*Peer),
	}
	m.rooms[roomID] = r
	m.codeToID[code] = roomID
	return r, nil
}

func generateSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (m *Manager) getRoomLocked(id string) (*Room, error) {
	r, ok := m.rooms[id]
	if !ok {
		return nil, ErrRoomNotFound
	}
	if r.IsExpired(m.now()) {
		return nil, ErrRoomExpired
	}
	return r, nil
}

// FindByID returns a room by ID.
func (m *Manager) FindByID(id string) (*Room, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.getRoomLocked(id)
}

// FindByCode returns a room by join code.
func (m *Manager) FindByCode(code string) (*Room, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	roomID, ok := m.codeToID[code]
	if !ok {
		return nil, ErrRoomNotFound
	}
	return m.getRoomLocked(roomID)
}

// AddPeer registers a peer in the room.
func (m *Manager) AddPeer(roomID string, peer *Peer) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	r, err := m.getRoomLocked(roomID)
	if err != nil {
		return err
	}
	if len(r.Peers) >= maxPeers {
		return ErrRoomFull
	}
	r.Peers[peer.ID] = peer
	return nil
}

// RemovePeer removes a peer from its room by connection ID.
func (m *Manager) RemovePeer(connID string) (*Room, *Peer, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, r := range m.rooms {
		for id, p := range r.Peers {
			if p.ConnID == connID {
				delete(r.Peers, id)
				return r, p, true
			}
		}
	}
	return nil, nil, false
}

// GetRoomByConnID finds the room containing a connection.
func (m *Manager) GetRoomByConnID(connID string) (*Room, *Peer, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, r := range m.rooms {
		if p, ok := r.FindPeerByConnID(connID); ok {
			return r, p, true
		}
	}
	return nil, nil, false
}

// SetHostPeerID updates the host peer ID after WS registration.
func (m *Manager) SetHostPeerID(roomID, hostPeerID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	r, err := m.getRoomLocked(roomID)
	if err != nil {
		return err
	}
	r.HostPeerID = hostPeerID
	return nil
}
