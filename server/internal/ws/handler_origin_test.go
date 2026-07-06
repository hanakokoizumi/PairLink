package ws

import (
	"slices"
	"testing"
)

func TestOriginPatternsIncludesDevLANPatterns(t *testing.T) {
	patterns := originPatterns("http://localhost:8080")
	want := []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://192.168.*",
		"http://10.*",
		"http://172.*",
	}
	for _, pattern := range want {
		if !slices.Contains(patterns, pattern) {
			t.Fatalf("missing pattern %q in %v", pattern, patterns)
		}
	}
}

func TestOriginPatternsSkipsDevLANPatternsForProductionURL(t *testing.T) {
	patterns := originPatterns("https://pairlink.example.com")
	if slices.Contains(patterns, "http://192.168.*") {
		t.Fatalf("unexpected dev LAN pattern in production config: %v", patterns)
	}
}
