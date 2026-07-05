package room

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateCode_format(t *testing.T) {
	for i := 0; i < 100; i++ {
		code, err := GenerateCode(5)
		require.NoError(t, err)
		assert.Len(t, code, 5)
		assert.True(t, ValidateCodeFormat(code, 5))
	}
}

func TestGenerateCode_customLength(t *testing.T) {
	code, err := GenerateCode(6)
	require.NoError(t, err)
	assert.Len(t, code, 6)
	assert.True(t, ValidateCodeFormat(code, 6))
}

func TestValidateCodeFormat(t *testing.T) {
	assert.True(t, ValidateCodeFormat("4829A", 5))
	assert.True(t, ValidateCodeFormat("AB12Z", 5))
	assert.False(t, ValidateCodeFormat("4829", 5))
	assert.False(t, ValidateCodeFormat("abcde", 5))
	assert.False(t, ValidateCodeFormat("AB-12", 5))
}

func TestNormalizeCode(t *testing.T) {
	assert.Equal(t, "A1B2C", NormalizeCode("a1b2c"))
}
