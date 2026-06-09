package pty

import (
	"strings"
	"testing"
)

// TestOSCTitleUTF8WithC1Byte guards against a charm/x/ansi parser bug: byte
// 0x9C is the 8-bit C1 String Terminator, but it is ALSO a valid UTF-8
// continuation byte (e.g. "로" U+B85C = EB A1 9C). In a UTF-8 terminal no app
// emits a bare 0x9C as ST — OSC ends with BEL or ESC \ — so the parser must
// treat 0x9C inside an OSC string as data, not as a terminator. Without the
// fix, the title is truncated mid-character and the remainder leaks into the
// screen grid (and thus into every reconnect snapshot).
func TestOSCTitleUTF8WithC1Byte(t *testing.T) {
	const title = "⠂ Grafana 로그 경고 및 에러 알림 설정" // "로" contains byte 0x9C
	osc := "\x1b]0;" + title + "\x07"

	// Single write.
	t.Run("single", func(t *testing.T) {
		s := newTestSession(t, 199, 42)
		_, _ = s.emul.Write([]byte("hello" + osc + "world"))
		assertTitleClean(t, s, title)
	})

	// Split at every byte boundary — mimics PTY read chunking. The bug is
	// content-driven (the 0x9C byte), so it must hold regardless of where the
	// stream is cut.
	t.Run("split", func(t *testing.T) {
		seq := []byte("hello" + osc + "world")
		for split := 1; split < len(seq); split++ {
			s := newTestSession(t, 199, 42)
			_, _ = s.emul.Write(seq[:split])
			_, _ = s.emul.Write(seq[split:])
			if s.title != title {
				t.Fatalf("split=%d: title=%q want %q", split, s.title, title)
			}
		}
	})

	// The reconnect snapshot must carry the intact title and must not contain
	// any leaked title fragment painted into the grid.
	t.Run("snapshot", func(t *testing.T) {
		s := newTestSession(t, 199, 42)
		_, _ = s.emul.Write([]byte(osc + "body-line"))
		assertTitleClean(t, s, title)
		snap := string(s.snapshotLocked())
		if !strings.Contains(snap, "\x1b]0;"+title+"\x07") {
			t.Errorf("snapshot missing intact title OSC")
		}
	})
}

func assertTitleClean(t *testing.T, s *Session, want string) {
	t.Helper()
	if s.title != want {
		t.Errorf("title=%q want %q", s.title, want)
	}
	grid := s.emul.String()
	// Fragments that only appear if the OSC was prematurely terminated and its
	// tail printed into the grid.
	for _, leak := range []string{"그 경고", "에러 알림", "]0;"} {
		if strings.Contains(grid, leak) {
			t.Errorf("title leaked into grid (%q): %q", leak, strings.TrimRight(grid, " \n"))
		}
	}
}
