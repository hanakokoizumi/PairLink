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
	"github.com/hanakokoizumi/pairlink/server/internal/clientip"
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
	client.SetIP(clientip.FromRequest(r, h.cfg.TrustedProxyNets))
	if !h.auth.DisableAuth() {
		if token := auth.ExtractToken(r); token != "" {
			if claims, err := h.auth.ValidateToken(token); err == nil {
				client.SetUserID(claims.Subject)
			}
		}
	}
	h.hub.Register(client)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	go client.WritePump(ctx)
	client.ReadPump(ctx)
}

func originPatterns(publicURL string) []string {
	publicURL = strings.TrimRight(publicURL, "/")
	patterns := []string{publicURL}
	if strings.Contains(publicURL, "localhost") || strings.Contains(publicURL, "127.0.0.1") {
		patterns = append(patterns,
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://localhost:*",
			"http://127.0.0.1:*",
			"http://192.168.*",
			"http://10.*",
			"http://172.*",
		)
	}
	seen := make(map[string]struct{})
	out := make([]string, 0, len(patterns))
	for _, p := range patterns {
		p = strings.TrimRight(p, "/")
		if p == "" {
			continue
		}
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
	case "leave-room":
		err = h.handleLeaveRoom(c)
	case "signal":
		err = h.forwardEnvelope(c, env)
	case "e2e-handshake":
		err = h.forwardEnvelope(c, env)
	case "use-relay":
		err = h.handleUseRelay(c, env)
	case "use-webrtc":
		err = h.handleUseWebRTC(c, env)
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
			h.removePeerAndNotify(c)
		}
	}
}

func (h *Handler) removePeerAndNotify(c *Client) bool {
	r, peer, ok := h.rooms.GetRoomByConnID(c.ConnID())
	if !ok {
		return false
	}
	if _, _, removed := h.rooms.RemovePeer(c.ConnID()); removed {
		payload, _ := json.Marshal(Envelope{
			Type: "peer-left",
			Payload: PeerLeftPayload{
				PeerID: peer.ID,
				Role:   string(peer.Role),
			},
		})
		h.hub.BroadcastToRoom(r.ID, payload, c.ConnID())
	}
	c.SetPeer("", "", "")
	return true
}

func (h *Handler) handleLeaveRoom(c *Client) error {
	if !h.removePeerAndNotify(c) {
		return nil
	}
	return c.SendJSON(Envelope{Type: "left-room"})
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

func (h *Handler) sleepJoinFailure(clientIP string) {
	if delay := h.joinLimiter.failureDelay(clientIP); delay > 0 {
		time.Sleep(delay)
	}
}

func (h *Handler) sendHostWsConfig(c *Client, r *room.Room, peerID string) error {
	if err := c.SendJSON(Envelope{
		Type: "ws-config",
		Payload: WSConfigPayload{
			PeerID:          peerID,
			RoomID:          r.ID,
			Role:            string(room.RoleHost),
			WSFallback:      h.cfg.WSFallback,
			MaxMessageBytes: h.cfg.WSMaxMessageBytes,
			ConnectionMode:  string(r.ConnectionModeOrDefault()),
		},
	}); err != nil {
		return err
	}
	h.notifyExistingPeers(c, r, peerID)
	return nil
}

func (h *Handler) sendGuestWsConfig(c *Client, r *room.Room, peerID string) error {
	if err := c.SendJSON(Envelope{
		Type: "ws-config",
		Payload: WSConfigPayload{
			PeerID:          peerID,
			RoomID:          r.ID,
			Role:            string(room.RoleGuest),
			WSFallback:      h.cfg.WSFallback,
			MaxMessageBytes: h.cfg.WSMaxMessageBytes,
			ConnectionMode:  string(r.ConnectionModeOrDefault()),
		},
	}); err != nil {
		return err
	}
	h.notifyExistingPeers(c, r, peerID)
	return nil
}

func (h *Handler) tryIdempotentHostJoin(c *Client, roomID string) (bool, error) {
	existingRoom, existingPeer, ok := h.rooms.GetRoomByConnID(c.ConnID())
	if !ok || existingPeer.ID == "" || existingRoom.ID != roomID {
		return false, nil
	}
	if existingPeer.Role != room.RoleHost {
		return false, nil
	}
	return true, h.sendHostWsConfig(c, existingRoom, existingPeer.ID)
}

func (h *Handler) tryIdempotentGuestJoin(c *Client, roomID, code string) (bool, error) {
	existingRoom, existingPeer, ok := h.rooms.GetRoomByConnID(c.ConnID())
	if !ok || existingPeer.ID == "" {
		return false, nil
	}
	if existingPeer.Role != room.RoleGuest {
		return false, nil
	}
	if roomID != "" && existingRoom.ID == roomID {
		return true, h.sendGuestWsConfig(c, existingRoom, existingPeer.ID)
	}
	if code != "" && room.NormalizeCode(existingRoom.Code) == room.NormalizeCode(code) {
		return true, h.sendGuestWsConfig(c, existingRoom, existingPeer.ID)
	}
	return false, nil
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

	if handled, err := h.tryIdempotentHostJoin(c, p.RoomID); handled || err != nil {
		return err
	}

	if !h.joinLimiter.allow(c.ClientIP()) {
		return errors.New("rate limited")
	}

	r, err := h.rooms.FindByID(p.RoomID)
	if err != nil {
		h.joinLimiter.recordFailure(c.ClientIP())
		h.sleepJoinFailure(c.ClientIP())
		return err
	}

	if !h.auth.DisableAuth() {
		if uid := c.UserID(); uid != "" && uid != r.OwnerID {
			return errors.New("forbidden host join")
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

	if err := h.sendHostWsConfig(c, r, peerID); err != nil {
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
	if p.RoomID == "" && p.Code == "" {
		return errors.New("missing room identifier")
	}
	p.Code = room.NormalizeCode(p.Code)

	if handled, err := h.tryIdempotentGuestJoin(c, p.RoomID, p.Code); handled || err != nil {
		return err
	}

	if !h.joinLimiter.allow(c.ClientIP()) {
		return errors.New("rate limited")
	}

	var r *room.Room
	if p.RoomID != "" {
		r, err = h.rooms.FindByID(p.RoomID)
	} else {
		r, err = h.rooms.FindByCode(p.Code)
	}
	if err != nil {
		h.joinLimiter.recordFailure(c.ClientIP())
		h.sleepJoinFailure(c.ClientIP())
		return err
	}
	if p.RoomID != "" && p.Code != "" && r.Code != p.Code {
		h.joinLimiter.recordFailure(c.ClientIP())
		h.sleepJoinFailure(c.ClientIP())
		return room.ErrRoomNotFound
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

	if err := h.sendGuestWsConfig(c, r, peerID); err != nil {
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
	if env.Type == "chat" {
		if err := validateChatPayload(env.Payload, h.cfg.MessageMaxLength); err != nil {
			return err
		}
	}

	r, peer, ok := h.rooms.GetRoomByConnID(c.ConnID())
	if !ok {
		return errors.New("not in room")
	}
	other, ok := r.OtherPeer(peer.ID)
	if !ok {
		return nil
	}

	payload := env.Payload
	if payload == nil {
		payload = map[string]any{}
	}
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
		if m == nil {
			m = map[string]any{}
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

func (h *Handler) handleUseRelay(c *Client, env Envelope) error {
	return h.setConnectionModeAndForward(c, env, room.ModeRelay)
}

func (h *Handler) handleUseWebRTC(c *Client, env Envelope) error {
	return h.setConnectionModeAndForward(c, env, room.ModeWebRTC)
}

func (h *Handler) setConnectionModeAndForward(c *Client, env Envelope, mode room.ConnectionMode) error {
	r, _, ok := h.rooms.GetRoomByConnID(c.ConnID())
	if !ok {
		return errors.New("not in room")
	}
	r.SetConnectionMode(mode)
	return h.forwardEnvelope(c, env)
}

func validateChatPayload(payload any, maxLen int) error {
	if maxLen <= 0 {
		return nil
	}
	m, err := payloadAsMap(payload)
	if err != nil {
		return err
	}
	text, ok := m["text"]
	if !ok {
		return fmt.Errorf("invalid message text")
	}
	textStr, ok := text.(string)
	if !ok {
		return fmt.Errorf("invalid message text")
	}
	if len(textStr) > maxLen {
		return fmt.Errorf("message too long")
	}
	return nil
}

func payloadAsMap(payload any) (map[string]any, error) {
	if m, ok := payload.(map[string]any); ok {
		return m, nil
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	return m, nil
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
	if !h.hub.SendToPeer(other.ID, out) {
		return fmt.Errorf("peer offline")
	}
	return nil
}
