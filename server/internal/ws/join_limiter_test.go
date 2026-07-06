package ws

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hanakokoizumi/pairlink/server/internal/auth"
	"github.com/hanakokoizumi/pairlink/server/internal/config"
	"github.com/hanakokoizumi/pairlink/server/internal/room"
)

func TestJoinLimiter_nilAllowsAll(t *testing.T) {
	l := newJoinLimiter(0)
	assert.True(t, l.allow("1.2.3.4"))
}

func TestJoinLimiter_blocksAfterLimit(t *testing.T) {
	l := newJoinLimiter(2)
	key := "203.0.113.1"
	assert.True(t, l.allow(key))
	assert.True(t, l.allow(key))
	assert.False(t, l.allow(key))
}

func TestJoinLimiter_prunesExpiredHits(t *testing.T) {
	l := newJoinLimiter(1)
	key := "203.0.113.2"
	assert.True(t, l.allow(key))
	assert.False(t, l.allow(key))

	l.mu.Lock()
	l.hits[key] = []time.Time{time.Now().Add(-2 * time.Minute)}
	l.mu.Unlock()

	assert.True(t, l.allow(key))
}

func TestJoinLimiter_failureDelayCapsAtTwoSeconds(t *testing.T) {
	l := newJoinLimiter(10)
	key := "203.0.113.3"
	for i := 0; i < 100; i++ {
		l.recordFailure(key)
	}
	delay := l.failureDelay(key)
	assert.LessOrEqual(t, delay, 2050*time.Millisecond)
}

func TestHandleHostJoin_idempotentSkipsRateLimit(t *testing.T) {
	rooms := room.NewManager(time.Hour, 5)
	defer rooms.Stop()

	created, err := rooms.Create("owner")
	require.NoError(t, err)

	peer := &room.Peer{
		ID:       "peer-1",
		ConnID:   "conn-1",
		Role:     room.RoleHost,
		JoinedAt: time.Now(),
	}
	require.NoError(t, rooms.AddPeer(created.ID, peer))

	jwt := auth.NewJWTManager("test-secret", time.Hour)
	authSvc := auth.NewService(nil, jwt, nil, true)

	h := &Handler{
		cfg:         &config.Config{DisableAuth: true, WSFallback: true},
		auth:        authSvc,
		hub:         NewHub(rooms),
		rooms:       rooms,
		joinLimiter: newJoinLimiter(1),
	}
	require.True(t, h.joinLimiter.allow("127.0.0.1"))

	client := &Client{
		connID: "conn-1",
		hub:    h.hub,
		send:   make(chan []byte, 4),
	}
	client.SetIP("127.0.0.1")
	client.SetPeer(peer.ID, created.ID, string(room.RoleHost))

	err = h.handleHostJoin(client, HostJoinPayload{RoomID: created.ID})
	assert.NoError(t, err)
}

func TestHandleHostJoin_rateLimitedForNewJoin(t *testing.T) {
	rooms := room.NewManager(time.Hour, 5)
	defer rooms.Stop()

	created, err := rooms.Create("owner")
	require.NoError(t, err)

	jwt := auth.NewJWTManager("test-secret", time.Hour)
	authSvc := auth.NewService(nil, jwt, nil, true)

	h := &Handler{
		cfg:         &config.Config{DisableAuth: true, WSFallback: true},
		auth:        authSvc,
		hub:         NewHub(rooms),
		rooms:       rooms,
		joinLimiter: newJoinLimiter(1),
	}
	require.True(t, h.joinLimiter.allow("127.0.0.1"))

	client := &Client{
		connID: "conn-2",
		hub:    h.hub,
		send:   make(chan []byte, 4),
	}
	client.SetIP("127.0.0.1")

	err = h.handleHostJoin(client, HostJoinPayload{RoomID: created.ID})
	assert.ErrorContains(t, err, "rate limited")
}

func TestWsErrorCode_rateLimited(t *testing.T) {
	assert.Equal(t, "rate_limited", wsErrorCode(errors.New("rate limited")))
}
