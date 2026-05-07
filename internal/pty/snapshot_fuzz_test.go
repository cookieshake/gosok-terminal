package pty

import (
	"testing"

	"github.com/charmbracelet/x/vt"
)

// FuzzSnapshotRoundTrip feeds arbitrary bytes through a VT emulator, takes a
// snapshot via snapshotLocked, applies the snapshot to a fresh emulator, and
// asserts both emulators end up rendering the same screen and cursor.
//
// This is the strongest correctness guarantee for snapshot synthesis: a
// reconnecting client receiving the snapshot ends up in the same state as a
// client that received the original byte stream. Any DECSET mode, OSC field,
// or screen content the snapshot fails to encode shows up here as a Render
// or cursor mismatch.
//
// Run with: go test -fuzz=FuzzSnapshotRoundTrip ./internal/pty/
//
// In CI/regular runs (without -fuzz), only the seed corpus runs — these are
// regression cases harvested from past bugs and should always pass quickly.
func FuzzSnapshotRoundTrip(f *testing.F) {
	// Seed corpus: replay the hardcoded TestSnapshotRoundTrip cases so they
	// also serve as fuzz seeds. Each pair (input, cols, rows) captures a
	// known-good shape that future fuzzing should never regress on.
	seeds := []struct {
		input []byte
		cols  int
		rows  int
	}{
		{[]byte("\x1b[?1049h\x1b[?1000h\x1b[?1002h\x1b[?1006h\x1b[?2004h\x1b[?25l\x1b[2;5HFoo \x1b[1;31mBar\x1b[0m"), 80, 24},
		{[]byte("hello\r\n\x1b[31mred\x1b[0m world\r\nthird"), 80, 24},
		{[]byte("garbage\x1b[2J\x1b[Hclean text"), 80, 24},
		{[]byte("\x1b]0;mytitle\x07\x1b]7;file:///tmp/x\x07hello"), 80, 24},
		{[]byte("\x1b[?1049h\x1b[1;1HALT\r\nSECOND"), 80, 24},
		{[]byte("scroll1\r\nscroll2\r\nscroll3\r\nscroll4"), 10, 3},
	}
	for _, s := range seeds {
		f.Add(s.input, s.cols, s.rows)
	}

	f.Fuzz(func(t *testing.T, input []byte, cols, rows int) {
		// Constrain dimensions to plausible terminal sizes — emul Resize on
		// pathological values (0, negative, huge) is out of scope for this
		// test and would just generate noise.
		if cols < 2 || cols > 200 || rows < 2 || rows > 100 {
			t.Skip("dimensions out of range")
		}
		// Bound input length so individual fuzz cases don't time out.
		if len(input) > 8192 {
			t.Skip("input too large")
		}
		// Restrict to ASCII (incl. ESC). Combining marks and other multi-byte
		// codepoints expose a charm/x/vt round-trip quirk: line.Render() can
		// emit a combining mark before its base cell content, and replaying
		// that through emul.Write() drops the mark (no preceding base). That
		// is a library-level concern, not a snapshot composition gap; we
		// exclude non-ASCII to keep this fuzz focused on control-sequence
		// coverage. Reproducer: input "0000\r֖" — cell 1 holds '0' with a
		// combining U+05D6, but Render() returns "֖0" which round-trips lossy.
		for _, b := range input {
			if b >= 0x80 {
				t.Skip("non-ASCII input (combining-mark round-trip is library-level)")
			}
		}
		// Skip CSI sequences that make the emulator write a response back to
		// the host (Device Attributes, Device Status Report). The charm/x/vt
		// emulator pipes the response through an io.Pipe whose reader is the
		// PTY's stdin in production; in this test there is no reader, so the
		// write blocks and the fuzz worker hangs. This is a library-level
		// behavior, not a snapshot bug — out of scope for this PR.
		// Reproducer: input \x1b[c with the standard DA1 handler.
		for i := 0; i+1 < len(input); i++ {
			if input[i] != 0x1b || input[i+1] != '[' {
				continue
			}
			// Scan past parameter/intermediate bytes to the final byte.
			for j := i + 2; j < len(input); j++ {
				c := input[j]
				if c >= 0x40 && c <= 0x7e {
					if c == 'c' || c == 'n' {
						t.Skip("input requests host response (DA/DSR)")
					}
					break
				}
			}
		}

		s := newTestSession(t, cols, rows)
		_, _ = s.emul.Write(input)
		snap := s.snapshotLocked()

		b := vt.NewEmulator(cols, rows)
		defer func() { _ = b.Close() }()
		_, _ = b.Write(snap)

		// Compare via Render() rather than String(): Render() preserves SGR
		// styling (colors, attributes), so a snapshot that re-encodes content
		// but loses SGR state fails here. String() would silently pass
		// because plain-text content can match while colors diverge.
		if got, want := b.Render(), s.emul.Render(); got != want {
			t.Errorf("Render mismatch after snapshot round-trip\n--- original ---\n%q\n--- snapshot ---\n%q\n--- A.Render ---\n%s\n--- B.Render ---\n%s",
				input, snap, want, got)
		}
		if got, want := b.CursorPosition(), s.emul.CursorPosition(); got != want {
			t.Errorf("Cursor mismatch: A=%v B=%v\ninput=%q\nsnap=%q",
				want, got, input, snap)
		}
	})
}
