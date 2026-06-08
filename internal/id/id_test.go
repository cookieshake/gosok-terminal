package id

import (
	"strings"
	"testing"
)

func TestNewLengthAndCharset(t *testing.T) {
	for i := 0; i < 1000; i++ {
		got := New()
		if len(got) != length {
			t.Fatalf("New() length = %d, want %d (%q)", len(got), length, got)
		}
		for _, r := range got {
			if !strings.ContainsRune(alphabet, r) {
				t.Fatalf("New() = %q contains non-base62 rune %q", got, r)
			}
		}
	}
}

func TestNewUniqueness(t *testing.T) {
	const n = 100000
	seen := make(map[string]struct{}, n)
	for i := 0; i < n; i++ {
		got := New()
		if _, dup := seen[got]; dup {
			t.Fatalf("New() produced duplicate %q within %d samples", got, n)
		}
		seen[got] = struct{}{}
	}
}
