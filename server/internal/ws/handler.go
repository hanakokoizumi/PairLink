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
	cfg         *config.Config
	auth        *auth.Service
	hub         *Hub
	rooms       *room.Manager
	relay       *relay.Forwarder
	joinLimiter *joinLimiter
}

// NewHandler creates a WebSocket HTTP handler.
func NewHandler(cfg *config.Config, authSvc *auth.Service, hub *Hub, rooms *room.Manager, relayFwd *relay.Forwarder) *Handler {
	return &Handler{
		cfg:         cfg,
		auth:        authSvc,
		hub:         hub,
		rooms:       rooms,
		relay:       relayFwd,
		joinLimiter: newJoinLimiter(cfg.JoinRateLimit),
	}
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
	client.SetIP(clientIP(r))
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
	var err error
	switch env.Type {
	case "auth":
		err = h.handleAuth(c, env.Payload)
	case "host-join":
		err = h.handleHostJoin(c, env.Payload)
	case "join-room":
		err = h.handleJoinRoom(c, env.Payload)
	case "signal":
		err = h.forwardEnvelope(c, env)
	case "e2e-handshake":
		err = h.forwardEnvelope(c, env)
	case "chat":
		err = h.forwardEnvelope(c, env)
	case "relay-chunk":
		err = h.handleRelayChunk(c, env.Payload)
	default:
		return nil
	}
	if err != nil {
		_ = c.SendJSON(Envelope{
			Type:    "error",
			Payload: ErrorPayload{Code: wsErrorCode(err)},
		})
	}
	return err
}

func wsErrorCode(err error) string {
	switch {
	case errors.Is(err, room.ErrRoomNotFound):
		return "room_not_found"
	case errors.Is(err, room.ErrRoomExpired):
		return "room_expired"
	case errors.Is(err, room.ErrRoomFull):
		return "room_full"
	case strings.Contains(err.Error(), "rate limited"):
		return "rate_limited"
	default:
		return "join_failed"
	}
}

func (h *Handler) leaveOtherRoom(c *Client, targetRoomID string) {
	if existingRoom, _, ok := h.rooms.GetRoomByConnID(c.ConnID()); ok {
		if existingRoom.ID != targetRoomID {
			h.rooms.RemovePeer(c.ConnID())
			c.SetPeer("", "", "")
		}
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

	if !h.auth.DisableAuth() {
		if uid := c.UserID(); uid != "" && uid != r.OwnerID {
			return errors.New("forbidden host join")
		}
	}

	// Idempotent re-join for the same connection.
	if existingRoom, existingPeer, ok := h.rooms.GetRoomByConnID(c.ConnID()); ok {
		if existingRoom.ID == r.ID && existingPeer.ID != "" {
			if err := c.SendJSON(Envelope{
				Type: "ws-config",
				Payload: WSConfigPayload{
					PeerID:          existingPeer.ID,
					RoomID:          r.ID,
					Role:            string(room.RoleHost),
					WSFallback:      h.cfg.WSFallback,
					MaxMessageBytes: h.cfg.WSMaxMessageBytes,
				},
			}); err != nil {
				return err
			}
			h.notifyExistingPeers(c, r, existingPeer.ID)
			return nil
		}
	}

	h.leaveOtherRoom(c, r.ID)

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
	c.SetPeer(peerID, r.ID, string(room.RoleHost))

	if err := c.SendJSON(Envelope{
		Type: "ws-config",
		Payload: WSConfigPayload{
			PeerID:          peerID,
			RoomID:          r.ID,
			Role:            string(room.RoleHost),
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
			Role:   string(room.RoleHost),
		},
	})
	h.hub.BroadcastToRoom(r.ID, joined, c.ConnID())
	h.notifyExistingPeers(c, r, peerID)
	return nil
}

func (h *Handler) notifyExistingPeers(c *Client, r *room.Room, selfPeerID string) {
	for _, p := range h.rooms.ListPeers(r.ID) {
		if p.ID == selfPeerID {
			continue
		}
		_ = c.SendJSON(Envelope{
			Type: "peer-joined",
			Payload: PeerJoinedPayload{
				PeerID: p.ID,
				Role:   string(p.Role),
			},
		})
	}
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
		if !h.joinLimiter.allow(c.ClientIP()) {
			return errors.New("rate limited")
		}
		r, err = h.rooms.FindByID(p.RoomID)
	} else if p.Code != "" {
		if !h.joinLimiter.allow(c.ClientIP()) {
			return errors.New("rate limited")
		}
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

	// Idempotent re-join for the same connection.
	if existingRoom, existingPeer, ok := h.rooms.GetRoomByConnID(c.ConnID()); ok {
		if existingRoom.ID == r.ID && existingPeer.ID != "" {
			if err := c.SendJSON(Envelope{
				Type: "ws-config",
				Payload: WSConfigPayload{
					PeerID:          existingPeer.ID,
					RoomID:          r.ID,
					Role:            string(room.RoleGuest),
					WSFallback:      h.cfg.WSFallback,
					MaxMessageBytes: h.cfg.WSMaxMessageBytes,
				},
			}); err != nil {
				return err
			}
			h.notifyExistingPeers(c, r, existingPeer.ID)
			return nil
		}
	}

	h.leaveOtherRoom(c, r.ID)

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
	h.notifyExistingPeers(c, r, peerID)
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

	payload := env.Payload
	if m, ok := payload.(map[string]any); ok {
		m["from"] = peer.ID
		payload = m
	} else {
		raw, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		var m map[string]any
		if err := json.Unmarshal(raw, &m); err != nil {
			return err
		}
		m["from"] = peer.ID
		payload = m
	}

	out, err := json.Marshal(Envelope{Type: env.Type, Payload: payload})
	if err != nil {
		return err
	}
	if !h.hub.SendToPeer(other.ID, out) {
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
