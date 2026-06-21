package room

import (
	"crypto/rand"
	"encoding/binary"
	"strconv"
)

const (
	minCode = 10000
	maxCode = 99999
)

// GenerateCode returns a cryptographically random 5-digit code in [10000, 99999].
func GenerateCode() (string, error) {
	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	n := minCode + int(binary.BigEndian.Uint32(b[:])%90000)
	return strconv.Itoa(n), nil
}

// ValidateCodeFormat checks that code is exactly 5 decimal digits.
func ValidateCodeFormat(code string) bool {
	if len(code) != 5 {
		return false
	}
	for _, c := range code {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
