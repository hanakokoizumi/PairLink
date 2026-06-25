package ws

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

const (
	sendBufferSize = 64
	pingInterval   = 30 * time.Second
	pongTimeout    = 10 * time.Second
)

// Client represents one WebSocket connection.
type Client struct {
	connID string
	conn   *websocket.Conn
	hub    *Hub
	send   chan []byte

	mu       sync.Mutex
	peerID   string
	roomID   string
	role     string
	userID   string
	lastPong time.Time

	maxMessageBytes int64
	onMessage       func(*Client, Envelope) error
}

// NewClient creates a WebSocket client wrapper.
func NewClient(conn *websocket.Conn, hub *Hub, maxMessageBytes int64, onMessage func(*Client, Envelope) error) *Client {
	return &Client{
		connID:          uuid.NewString(),
		conn:            conn,
		hub:             hub,
		send:            make(chan []byte, sendBufferSize),
		lastPong:        time.Now(),
		maxMessageBytes: maxMessageBytes,
		onMessage:       onMessage,
	}
}

// ConnID returns the connection identifier.
func (c *Client) ConnID() string {
	return c.connID
}

// PeerID returns the assigned peer ID.
func (c *Client) PeerID() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.peerID
}

// RoomID returns the room ID when joined.
func (c *Client) RoomID() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.roomID
}

// SetPeer sets peer metadata after join.
func (c *Client) SetPeer(peerID, roomID, role string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.peerID = peerID
	c.roomID = roomID
	c.role = role
}

// SetUserID binds an authenticated user ID.
func (c *Client) SetUserID(userID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.userID = userID
}

// UserID returns the authenticated user ID.
func (c *Client) UserID() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.userID
}

// TrySend enqueues a message without blocking.
func (c *Client) TrySend(msg []byte) bool {
	select {
	case c.send <- msg:
		return true
	default:
		return false
	}
}

// SendJSON marshals and sends an envelope.
func (c *Client) SendJSON(env Envelope) error {
	data, err := json.Marshal(env)
	if err != nil {
		return err
	}
	if !c.TrySend(data) {
		return context.Canceled
	}
	return nil
}

// ReadPump reads messages from the WebSocket.
func (c *Client) ReadPump(ctx context.Context) {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close(websocket.StatusNormalClosure, "closed")
	}()

	for {
		_, data, err := c.conn.Read(ctx)
		if err != nil {
			return
		}
		if int64(len(data)) > c.maxMessageBytes {
			log.Warn().Str("conn", c.connID).Msg("message too large")
			return
		}
		var env Envelope
		if err := json.Unmarshal(data, &env); err != nil {
			continue
		}
		if env.Type == "pong" {
			c.mu.Lock()
			c.lastPong = time.Now()
			c.mu.Unlock()
			continue
		}
		if c.onMessage != nil {
			if err := c.onMessage(c, env); err != nil {
				log.Debug().Err(err).Str("type", env.Type).Msg("ws message error")
			}
		}
	}
}

// WritePump writes queued messages and sends pings.
func (c *Client) WritePump(ctx context.Context) {
	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()

	for {
		select {
		case msg, ok := <-c.send:
			if !ok {
				return
			}
			if err := c.conn.Write(ctx, websocket.MessageText, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.mu.Lock()
			stale := time.Since(c.lastPong) > pongTimeout+pingInterval
			c.mu.Unlock()
			if stale {
				return
			}
			_ = c.SendJSON(Envelope{Type: "ping"})
		case <-ctx.Done():
			return
		}
	}
}
