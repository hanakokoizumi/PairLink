package main

import (
	"flag"
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHashPassword_outputFormat(t *testing.T) {
	cmd := exec.Command("go", "run", ".", "--password", "test-password")
	out, err := cmd.CombinedOutput()
	require.NoError(t, err, string(out))
	hash := strings.TrimSpace(string(out))
	assert.True(t, strings.HasPrefix(hash, "$2a$") || strings.HasPrefix(hash, "$2b$"))
}

func TestHashPassword_missingPassword(t *testing.T) {
	// reset flags for subprocess test via exec only; unit test main directly
	if os.Getenv("PAIRLINK_TEST_HASH_MAIN") == "1" {
		return
	}
	cmd := exec.Command("go", "run", ".")
	out, err := cmd.CombinedOutput()
	require.Error(t, err)
	assert.Contains(t, string(out), "Usage: hash-password")
}

func TestMain(m *testing.M) {
	flag.Parse()
	os.Exit(m.Run())
}
