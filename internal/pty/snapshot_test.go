package pty

import (
	"bytes"
	"testing"

	"github.com/charmbracelet/x/ansi"
	"github.com/charmbracelet/x/vt"
)

// newTestSession builds an in-memory Session that exercises the emulator
// state shadow without spawning a real PTY.
func newTestSession(t *testing.T, cols, rows int) *Session {
	t.Helper()
	s := &Session{
		scrollback: newRingBuffer(scrollbackSize),
		modes:      map[ansi.Mode]bool{},
		cursorVis:  true,
	}
	s.emul = vt.NewEmulator(cols, rows)
	s.emul.SetCallbacks(vt.Callbacks{
		EnableMode:       func(m ansi.Mode) { s.modes[m] = true },
		DisableMode:      func(m ansi.Mode) { delete(s.modes, m) },
		Title:            func(t string) { s.title = t },
		WorkingDirectory: func(c string) { s.cwd = c },
		CursorVisibility: func(v bool) { s.cursorVis = v },
		AltScreen:        func(on bool) { s.altScreen = on },
	})
	t.Cleanup(func() { _ = s.emul.Close() })
	return s
}

func snapshotState(t *testing.T, write []byte, cols, rows int) []byte {
	t.Helper()
	s := newTestSession(t, cols, rows)
	_, _ = s.emul.Write(write)
	_, _ = s.scrollback.Write(write)
	return s.snapshotLocked()
}

func TestSnapshotIncludesAltScreenMode(t *testing.T) {
	// opencode-style startup: enter alt-screen + enable mouse + draw something.
	// The bug we fixed: a reconnecting client that never saw the original
	// ?1049h would render to primary instead of alt. Snapshot must re-emit it.
	input := []byte("\x1b[?1049h\x1b[?1000h\x1b[?1006h\x1b[5;5HHello")
	snap := snapshotState(t, input, 80, 24)

	for _, want := range []string{"\x1b[?1049h", "\x1b[?1000h", "\x1b[?1006h", "Hello"} {
		if !bytes.Contains(snap, []byte(want)) {
			t.Errorf("snapshot missing %q", want)
		}
	}
	if !bytes.HasPrefix(snap, []byte("\x1bc")) {
		t.Errorf("snapshot must start with RIS \\x1bc")
	}
}

func TestSnapshotPreservesTitleAndCwd(t *testing.T) {
	input := []byte("\x1b]0;mytitle\x07\x1b]7;file:///tmp/x\x07hello")
	snap := snapshotState(t, input, 80, 24)

	if !bytes.Contains(snap, []byte("\x1b]0;mytitle\x07")) {
		t.Errorf("snapshot missing title")
	}
	if !bytes.Contains(snap, []byte("\x1b]7;file:///tmp/x\x07")) {
		t.Errorf("snapshot missing cwd")
	}
}

func TestSnapshotAfterResizeClearsStaleAltContent(t *testing.T) {
	// A reconnect that races a resize used to ship a snapshot containing the
	// pre-resize alt rows at their old coordinates while the app's SIGWINCH
	// redraw only painted the new coordinates, leaving ghost rows in the
	// subscriber's alt buffer (e.g. Claude Code status line appearing twice).
	// resizeEmulatorLocked clears the emulator's alt buffer when on alt-screen
	// so the next snapshot does not carry stale rows.
	s := newTestSession(t, 80, 24)

	// Enter alt-screen and paint a marker near the bottom — exactly where a
	// TUI status line would live, and the same kind of row that used to ghost.
	_, _ = s.emul.Write([]byte("\x1b[?1049h\x1b[23;1HSTALE_STATUS"))

	if !bytes.Contains(s.snapshotLocked(), []byte("STALE_STATUS")) {
		t.Fatalf("baseline snapshot should contain alt content; setup is wrong")
	}

	s.resizeEmulatorLocked(30, 80)

	if bytes.Contains(s.snapshotLocked(), []byte("STALE_STATUS")) {
		t.Errorf("snapshot after resize must not carry stale alt-screen rows")
	}
}

func TestSnapshotRoundTrip(t *testing.T) {
	// Feed input through emulator A, snapshot, feed snapshot through emulator
	// B (fresh), assert A and B render identically. The strongest guarantee:
	// a reconnecting client receiving the snapshot ends up in the same state
	// as a client that received the original byte stream.
	cases := map[string][]byte{
		"alt-screen + mouse":     []byte("\x1b[?1049h\x1b[?1000h\x1b[?1002h\x1b[?1006h\x1b[?2004h\x1b[?25l\x1b[2;5HFoo \x1b[1;31mBar\x1b[0m"),
		"primary screen content": []byte("hello\r\n\x1b[31mred\x1b[0m world\r\nthird"),
		"plain after clear":      []byte("garbage\x1b[2J\x1b[Hclean text"),
	}
	for name, input := range cases {
		t.Run(name, func(t *testing.T) {
			snap := snapshotState(t, input, 80, 24)

			b := vt.NewEmulator(80, 24)
			defer func() { _ = b.Close() }()
			_, _ = b.Write(snap)

			a := vt.NewEmulator(80, 24)
			defer func() { _ = a.Close() }()
			_, _ = a.Write(input)

			if a.Render() != b.Render() {
				t.Errorf("Render mismatch\n--- A ---\n%s\n--- B ---\n%s",
					a.Render(), b.Render())
			}
			if a.CursorPosition() != b.CursorPosition() {
				t.Errorf("cursor mismatch: A=%v B=%v",
					a.CursorPosition(), b.CursorPosition())
			}
		})
	}
}
