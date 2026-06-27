package room

import (
	"crypto/rand"
	"encoding/binary"
	"math"
	"strconv"
)

const defaultCodeLength = 5

// GenerateCode returns a cryptographically random decimal code with the given length.
func GenerateCode(length int) (string, error) {
	if length <= 0 || length > 9 {
		length = defaultCodeLength
	}
	min := int(math.Pow10(length - 1))
	max := int(math.Pow10(length)) - 1
	span := uint32(max - min + 1)

	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	n := min + int(binary.BigEndian.Uint32(b[:])%span)
	return leftPad(strconv.Itoa(n), length), nil
}

// ValidateCodeFormat checks that code is exactly length decimal digits.
func ValidateCodeFormat(code string, length int) bool {
	if length <= 0 {
		length = defaultCodeLength
	}
	if len(code) != length {
		return false
	}
	for _, c := range code {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

func leftPad(value string, length int) string {
	for len(value) < length {
		value = "0" + value
	}
	return value
}
