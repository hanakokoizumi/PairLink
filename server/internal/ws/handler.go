package ws

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/hanakokoizumi/pairlink/server/internal/auth"
	"github.com/hanakokoizumi/pairlink/server/internal/config"
	"github.com/hanakokoizumi/pairlink/server/internal/relay"
	"github.com/hanakokoizumi/pairlink/server/internal/room"
)

// Handler serves the WebSocket endpoint.
type Handler struct {
	cfg    *config.Config
	auth   *auth.Service
	hub    *Hub
	rooms  *room.Manager
	relay  *relay.Forwarder
}

// NewHandler creates a WebSocket HTTP handler.
func NewHandler(cfg *config.Config, authSvc *auth.Service, hub *Hub, rooms *room.Manager, relayFwd *relay.Forwarder) *Handler {
	return &Handler{cfg: cfg, auth: authSvc, hub: hub, rooms: rooms, relay: relayFwd}
}

// ServeHTTP upgrades HTTP to WebSocket.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	opts := &websocket.AcceptOptions{
		OriginPatterns: originPatterns(h.cfg.PublicURL),
	}
	conn, err := websocket.Accept(w, r, opts)
	if err != nil {
		log.Debug().Err(err).Msg("websocket accept failed")
		return
	}

	client := NewClient(conn, h.hub, int64(h.cfg.WSMaxMessageBytes), h.handleMessage)
	h.hub.Register(client)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	go client.WritePump(ctx)
	client.ReadPump(ctx)
}

func originPatterns(publicURL string) []string {
	patterns := []string{publicURL, "http://localhost:3000", "http://127.0.0.1:3000"}
	seen := make(map[string]struct{})
	out := make([]string, 0, len(patterns))
	for _, p := range patterns {
		p = strings.TrimRight(p, "/")
		if _, ok := seen[p]; !ok {
			seen[p] = struct{}{}
			out = append(out, p)
		}
	}
	return out
}

func (h *Handler) handleMessage(c *Client, env Envelope) error {
	switch env.Type {
	case "auth":
		return h.handleAuth(c, env.Payload)
	case "host-join":
		return h.handleHostJoin(c, env.Payload)
	case "join-room":
		return h.handleJoinRoom(c, env.Payload)
	case "signal":
		return h.forwardEnvelope(c, env)
	case "e2e-handshake":
		return h.forwardEnvelope(c, env)
	case "chat":
		return h.forwardEnvelope(c, env)
	case "relay-chunk":
		return h.handleRelayChunk(c, env.Payload)
	default:
		return nil
	}
}

func (h *Handler) handleAuth(c *Client, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	var p AuthPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return err
	}
	token := p.Token
	if token == "" {
		return errors.New("missing token")
	}
	claims, err := h.auth.ValidateToken(token)
	if err != nil {
		return err
	}
	c.SetUserID(claims.Subject)
	return c.SendJSON(Envelope{Type: "auth-ok"})
}

func (h *Handler) handleHostJoin(c *Client, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	var p HostJoinPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return err
	}

	if !h.auth.DisableAuth() {
		if c.UserID() == "" {
			token := p.Token
			if token == "" {
				return errors.New("unauthorized host join")
			}
			claims, err := h.auth.ValidateToken(token)
			if err != nil {
				return err
			}
			c.SetUserID(claims.Subject)
		}
	}

	r, err := h.rooms.FindByID(p.RoomID)
	if err != nil {
		return err
	}

	peerID := uuid.NewString()
	peer := &room.Peer{
		ID:       peerID,
		ConnID:   c.ConnID(),
		Role:     room.RoleHost,
		JoinedAt: time.Now(),
	}
	if err := h.rooms.AddPeer(r.ID, peer); err != nil {
		return err
	}
	_ = h.rooms.SetHostPeerID(r.ID, peerID)
	c.SetPeer(peerID, r.ID, string(room.RoleHost))

	return c.SendJSON(Envelope{
		Type: "ws-config",
		Payload: WSConfigPayload{
			PeerID:          peerID,
			RoomID:          r.ID,
			Role:            string(room.RoleHost),
			WSFallback:      h.cfg.WSFallback,
			MaxMessageBytes: h.cfg.WSMaxMessageBytes,
		},
	})
}

func (h *Handler) handleJoinRoom(c *Client, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	var p JoinRoomPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return err
	}

	var r *room.Room
	if p.RoomID != "" {
		r, err = h.rooms.FindByID(p.RoomID)
	} else if p.Code != "" {
		r, err = h.rooms.FindByCode(p.Code)
	} else {
		return errors.New("missing room identifier")
	}
	if err != nil {
		return err
	}
	if p.RoomID != "" && p.Code != "" && r.Code != p.Code {
		return room.ErrRoomNotFound
	}

	peerID := uuid.NewString()
	peer := &room.Peer{
		ID:       peerID,
		ConnID:   c.ConnID(),
		Role:     room.RoleGuest,
		JoinedAt: time.Now(),
	}
	if err := h.rooms.AddPeer(r.ID, peer); err != nil {
		return err
	}
	c.SetPeer(peerID, r.ID, string(room.RoleGuest))

	if err := c.SendJSON(Envelope{
		Type: "ws-config",
		Payload: WSConfigPayload{
			PeerID:          peerID,
			RoomID:          r.ID,
			Role:            string(room.RoleGuest),
			WSFallback:      h.cfg.WSFallback,
			MaxMessageBytes: h.cfg.WSMaxMessageBytes,
		},
	}); err != nil {
		return err
	}

	joined, _ := json.Marshal(Envelope{
		Type: "peer-joined",
		Payload: PeerJoinedPayload{
			PeerID: peerID,
			Role:   string(room.RoleGuest),
		},
	})
	h.hub.BroadcastToRoom(r.ID, joined, c.ConnID())
	return nil
}

func (h *Handler) forwardEnvelope(c *Client, env Envelope) error {
	r, peer, ok := h.rooms.GetRoomByConnID(c.ConnID())
	if !ok {
		return errors.New("not in room")
	}
	other, ok := r.OtherPeer(peer.ID)
	if !ok {
		return nil
	}
	data, err := json.Marshal(env)
	if err != nil {
		return err
	}
	if !h.hub.SendToPeer(other.ID, data) {
		return fmt.Errorf("peer offline")
	}
	return nil
}

func (h *Handler) handleRelayChunk(c *Client, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	var chunk RelayChunkPayload
	if err := json.Unmarshal(data, &chunk); err != nil {
		return err
	}

	r, peer, ok := h.rooms.GetRoomByConnID(c.ConnID())
	if !ok {
		return errors.New("not in room")
	}
	other, ok := h.relay.Forward(r, peer.ID)
	if !ok {
		return nil
	}
	out, err := json.Marshal(Envelope{Type: "relay-chunk", Payload: chunk})
	if err != nil {
		return err
	}
	h.hub.SendToPeer(other.ID, out)
	return nil
}
