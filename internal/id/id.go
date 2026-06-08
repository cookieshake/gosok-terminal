// Package id generates short, URL-safe random identifiers.
//
// IDs are 10-character base62 strings (~59 bits of entropy), short enough to
// type on the CLI while keeping collisions negligible for a single-host
// terminal multiplexer. Generation is safe for concurrent use.
package id

import (
	"crypto/rand"
)

const (
	alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	length   = 10
	// maxByte is the largest multiple of len(alphabet) that fits in a byte;
	// bytes at or above it are rejected to avoid modulo bias.
	maxByte = byte(256 - (256 % len(alphabet)))
)

// New returns a new 10-character base62 identifier.
func New() string {
	out := make([]byte, length)
	// Over-allocate the random buffer so rejection sampling rarely forces a
	// second rand.Read: with length+2 bytes the odds of exhausting it drop to
	// well under 1%.
	buf := make([]byte, length+2)
	for i := 0; i < length; {
		if _, err := rand.Read(buf); err != nil {
			// crypto/rand.Read never returns an error on supported platforms.
			panic("id: crypto/rand failed: " + err.Error())
		}
		for _, b := range buf {
			if b >= maxByte {
				continue // reject to keep the distribution uniform
			}
			out[i] = alphabet[int(b)%len(alphabet)]
			i++
			if i == length {
				break
			}
		}
	}
	return string(out)
}
