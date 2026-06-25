package ws

// Envelope is the common WebSocket JSON message wrapper.
type Envelope struct {
	Type    string `json:"type"`
	Payload any    `json:"payload,omitempty"`
}

// ErrorPayload reports a join or signaling failure to the client.
type ErrorPayload struct {
	Code string `json:"code"`
}

// AuthPayload is sent by clients to authenticate.
type AuthPayload struct {
	Token string `json:"token"`
}

// HostJoinPayload registers the host in a room.
type HostJoinPayload struct {
	RoomID string `json:"roomId"`
	Token  string `json:"token,omitempty"`
}

// JoinRoomPayload registers a guest by code.
type JoinRoomPayload struct {
	Code   string `json:"code"`
	RoomID string `json:"roomId"`
}

// PeerJoinedPayload notifies peers about a new participant.
type PeerJoinedPayload struct {
	PeerID string `json:"peerId"`
	Role   string `json:"role"`
}

// PeerLeftPayload notifies peers about a disconnect.
type PeerLeftPayload struct {
	PeerID string `json:"peerId"`
	Role   string `json:"role"`
}

// SignalPayload carries WebRTC signaling data.
type SignalPayload struct {
	To     string `json:"to,omitempty"`
	From   string `json:"from,omitempty"`
	SDP    any    `json:"sdp,omitempty"`
	Candidate any `json:"candidate,omitempty"`
}

// WSConfigPayload is sent to clients after joining.
type WSConfigPayload struct {
	PeerID      string `json:"peerId"`
	RoomID      string `json:"roomId"`
	Role        string `json:"role"`
	WSFallback  bool   `json:"wsFallback"`
	MaxMessageBytes int `json:"maxMessageBytes"`
}

// RelayChunkPayload is opaque ciphertext relayed between peers.
type RelayChunkPayload struct {
	TransferID string `json:"transferId"`
	Seq        int64  `json:"seq"`
	Ciphertext string `json:"ciphertext"`
	IV         string `json:"iv"`
	To         string `json:"to,omitempty"`
}

// ChatPayload carries chat messages over relay.
type ChatPayload struct {
	To      string `json:"to,omitempty"`
	Content any    `json:"content"`
}

// E2EHandshakePayload forwards public keys.
type E2EHandshakePayload struct {
	To        string `json:"to,omitempty"`
	PublicKey string `json:"publicKey"`
}
