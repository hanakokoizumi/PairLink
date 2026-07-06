package ws

import (
	"math/rand"
	"sync"
	"time"
)

type joinLimiter struct {
	limit int
	mu    sync.Mutex
	hits  map[string][]time.Time
	fail  map[string]int
}

func newJoinLimiter(limit int) *joinLimiter {
	if limit <= 0 {
		return nil
	}
	return &joinLimiter{
		limit: limit,
		hits:  make(map[string][]time.Time),
		fail:  make(map[string]int),
	}
}

func (l *joinLimiter) allow(key string) bool {
	if l == nil {
		return true
	}
	now := time.Now()
	cutoff := now.Add(-time.Minute)

	l.mu.Lock()
	defer l.mu.Unlock()

	recent := l.pruneHitsLocked(key, cutoff)
	if len(recent) >= l.limit {
		l.hits[key] = recent
		return false
	}
	l.hits[key] = append(recent, now)
	return true
}

func (l *joinLimiter) recordFailure(key string) {
	if l == nil {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.fail[key]++
}

func (l *joinLimiter) failureDelay(key string) time.Duration {
	if l == nil {
		return 0
	}
	l.mu.Lock()
	count := l.fail[key]
	l.mu.Unlock()
	if count <= 0 {
		return 0
	}
	ms := 50 * count
	if ms > 2000 {
		ms = 2000
	}
	jitter := rand.Intn(50)
	return time.Duration(ms+jitter) * time.Millisecond
}

func (l *joinLimiter) pruneHitsLocked(key string, cutoff time.Time) []time.Time {
	recent := l.hits[key][:0]
	for _, hit := range l.hits[key] {
		if hit.After(cutoff) {
			recent = append(recent, hit)
		}
	}
	if len(recent) == 0 {
		delete(l.hits, key)
		delete(l.fail, key)
	} else {
		l.hits[key] = recent
	}
	return recent
}
