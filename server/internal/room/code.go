package room

import (
	"crypto/rand"
	"strings"
)

const defaultCodeLength = 5

// Excludes I and O to avoid confusion with 1 and 0.
const codeAlphabet = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"

// GenerateCode returns a cryptographically random code (0-9, A-Z excluding I and O).
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

// NormalizeCode uppercases a join code and maps O/I to 0/1 for lookup.
func NormalizeCode(code string) string {
	code = strings.ToUpper(code)
	code = strings.ReplaceAll(code, "O", "0")
	code = strings.ReplaceAll(code, "I", "1")
	return code
}

// ValidateCodeFormat checks that code is exactly length valid characters (0-9, A-Z excluding I and O).
func ValidateCodeFormat(code string, length int) bool {
	if length <= 0 {
		length = defaultCodeLength
	}
	code = NormalizeCode(code)
	if len(code) != length {
		return false
	}
	for _, c := range code {
		if (c < '0' || c > '9') && (c < 'A' || c > 'Z') {
			return false
		}
		if c == 'I' || c == 'O' {
			return false
		}
	}
	return true
}
