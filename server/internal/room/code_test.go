package room

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateCode_range(t *testing.T) {
	for i := 0; i < 100; i++ {
		code, err := GenerateCode(5)
		require.NoError(t, err)
		assert.Len(t, code, 5)
		assert.True(t, ValidateCodeFormat(code, 5))
		n := 0
		for _, c := range code {
			n = n*10 + int(c-'0')
		}
		assert.GreaterOrEqual(t, n, 10000)
		assert.LessOrEqual(t, n, 99999)
	}
}

func TestGenerateCode_customLength(t *testing.T) {
	code, err := GenerateCode(6)
	require.NoError(t, err)
	assert.Len(t, code, 6)
	assert.True(t, ValidateCodeFormat(code, 6))
}

func TestValidateCodeFormat(t *testing.T) {
	assert.True(t, ValidateCodeFormat("48291", 5))
	assert.False(t, ValidateCodeFormat("4829", 5))
	assert.False(t, ValidateCodeFormat("abcde", 5))
}
