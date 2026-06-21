package room

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateCode_range(t *testing.T) {
	for i := 0; i < 100; i++ {
		code, err := GenerateCode()
		require.NoError(t, err)
		assert.Len(t, code, 5)
		assert.True(t, ValidateCodeFormat(code))
		n := 0
		for _, c := range code {
			n = n*10 + int(c-'0')
		}
		assert.GreaterOrEqual(t, n, minCode)
		assert.LessOrEqual(t, n, maxCode)
	}
}

func TestValidateCodeFormat(t *testing.T) {
	assert.True(t, ValidateCodeFormat("48291"))
	assert.False(t, ValidateCodeFormat("4829"))
	assert.False(t, ValidateCodeFormat("abcde"))
}
