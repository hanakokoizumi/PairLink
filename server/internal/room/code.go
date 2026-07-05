package room

import (
	"crypto/rand"
	"strings"
)

const defaultCodeLength = 5

const codeAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

// GenerateCode returns a cryptographically random alphanumeric code (0-9, A-Z).
func GenerateCode(length int) (string, error) {
	if length <= 0 || length > 12 {
		length = defaultCodeLength
	}
	out := make([]byte, length)
	randBytes := make([]byte, length)
	if _, err := rand.Read(randBytes); err != nil {
		return "", err
	}
	for i := range out {
		out[i] = codeAlphabet[int(randBytes[i])%len(codeAlphabet)]
	}
	return string(out), nil
}

// NormalizeCode uppercases ASCII letters in a join code for lookup.
func NormalizeCode(code string) string {
	return strings.ToUpper(code)
}

// ValidateCodeFormat checks that code is exactly length alphanumeric characters (A-Z, 0-9).
func ValidateCodeFormat(code string, length int) bool {
	if length <= 0 {
		length = defaultCodeLength
	}
	if len(code) != length {
		return false
	}
	for _, c := range code {
		if (c < '0' || c > '9') && (c < 'A' || c > 'Z') {
			return false
		}
	}
	return true
}
