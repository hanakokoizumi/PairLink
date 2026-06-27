package ws

import (
	"net"
	"net/http"
	"sync"
	"time"
)

type joinLimiter struct {
	limit int
	mu    sync.Mutex
	hits  map[string][]time.Time
}

func newJoinLimiter(limit int) *joinLimiter {
	if limit <= 0 {
		return nil
	}
	return &joinLimiter{limit: limit, hits: make(map[string][]time.Time)}
}

func (l *joinLimiter) allow(key string) bool {
	if l == nil {
		return true
	}
	now := time.Now()
	cutoff := now.Add(-time.Minute)

	l.mu.Lock()
	defer l.mu.Unlock()

	recent := l.hits[key][:0]
	for _, hit := range l.hits[key] {
		if hit.After(cutoff) {
			recent = append(recent, hit)
		}
	}
	if len(recent) >= l.limit {
		l.hits[key] = recent
		return false
	}
	l.hits[key] = append(recent, now)
	return true
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
