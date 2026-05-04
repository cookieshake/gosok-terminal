package pty

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/charmbracelet/x/ansi"
	"github.com/charmbracelet/x/vt"
	"github.com/creack/pty"
)

const scrollbackSize = 1 << 20 // 1 MiB

// OutputEvent represents data from the PTY or a process exit.
type OutputEvent struct {
	Data     []byte // PTY output; nil on exit
	Offset   uint64 // cumulative byte offset at end of Data; 0 for exit events
	ExitCode int    // valid only when Data is nil
}

type Subscriber = subscriber

type subscriber struct {
	ch      chan OutputEvent
	done    chan struct{} // closed on unsubscribe or replaced
	dropped atomic.Bool   // set when events were dropped; signals need for resync
}

func (s *subscriber) HasDropped() bool {
	return s.dropped.Load()
}

type Session struct {
	id           string
	cmd          *exec.Cmd
	ptmx         *os.File
	mu           sync.Mutex // protects ptmx writes
	doneCh       chan struct{}
	scrollback   *ringBuffer
	lastActivity atomic.Int64 // UnixMilli of last PTY output

	// dispatchMu serializes scrollback writes, emulator writes, and subscriber
	// list mutations. Holding it guarantees that any byte either lands in a
	// snapshot returned by Subscribe/Resync (and is NOT delivered as an event)
	// or lands in the event channel (and IS in the snapshot reflecting state
	// up to that byte) — never inconsistent across the boundary.
	dispatchMu sync.Mutex
	subs       []*subscriber
	exited     bool
	exitC      int

	// Terminal-state shadow for snapshot-on-reconnect. All fields below are
	// guarded by dispatchMu. emul callbacks fire synchronously inside
	// emul.Write (which we always call under dispatchMu), so callback
	// mutations of modes/title/cwd/cursorVis/altScreen are race-free with
	// snapshotLocked reads.
	emul      *vt.Emulator
	modes     map[ansi.Mode]bool
	title     string
	cwd       string
	cursorVis bool
	altScreen bool
}

func newSession(id, command string, args []string, dir string, env []string, rows, cols uint16) (*Session, error) {
	cmd := exec.Command(command, args...)
	if dir != "" {
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			cmd.Dir = dir
		}
	}
	cmd.Env = append(os.Environ(), "TERM=xterm-256color", "TERM_PROGRAM=ghostty")
	cmd.Env = append(cmd.Env, env...)

	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: rows, Cols: cols})
	if err != nil {
		return nil, err
	}

	s := &Session{
		id:         id,
		cmd:        cmd,
		ptmx:       ptmx,
		doneCh:     make(chan struct{}),
		scrollback: newRingBuffer(scrollbackSize),
		modes:      map[ansi.Mode]bool{},
		cursorVis:  true,
	}

	s.emul = vt.NewEmulator(int(cols), int(rows))
	s.emul.SetCallbacks(vt.Callbacks{
		EnableMode:       func(m ansi.Mode) { s.modes[m] = true },
		DisableMode:      func(m ansi.Mode) { delete(s.modes, m) },
		Title:            func(t string) { s.title = t },
		WorkingDirectory: func(c string) { s.cwd = c },
		CursorVisibility: func(v bool) { s.cursorVis = v },
		AltScreen:        func(on bool) { s.altScreen = on },
	})

	// The emulator generates query responses (DA, cursor position report, OSC
	// color queries, etc.) on its internal pipe. We don't route them to the
	// PTY because xterm.js is the canonical responder for the live client;
	// duplicating would cause double responses. Drain to prevent deadlock —
	// emul.Write blocks once the response pipe fills. The goroutine exits
	// when readLoop closes the emulator.
	go func() { _, _ = io.Copy(io.Discard, s.emul) }()

	go func() {
		_ = cmd.Wait()
		close(s.doneCh)
	}()

	go s.readLoop()

	return s, nil
}

func (s *Session) readLoop() {
	// Close the emulator under dispatchMu after the read loop terminates.
	// All emul.Write callers (readLoop and resizeEmulatorLocked) hold
	// dispatchMu, so closing the emulator under the same mutex guarantees no
	// in-flight Write races with Close. dispatchMu also pairs the Close with
	// any concurrent Resize/snapshotLocked.
	defer func() {
		s.dispatchMu.Lock()
		if s.emul != nil {
			_ = s.emul.Close()
		}
		s.dispatchMu.Unlock()
	}()

	buf := make([]byte, 32*1024)
	for {
		n, err := s.ptmx.Read(buf)
		if n > 0 {
			data := make([]byte, n)
			copy(data, buf[:n])

			s.dispatchMu.Lock()
			_, _ = s.scrollback.Write(data)
			_, _ = s.emul.Write(data)
			offset := s.scrollback.Offset()
			subs := make([]*subscriber, len(s.subs))
			copy(subs, s.subs)
			s.dispatchMu.Unlock()

			s.lastActivity.Store(time.Now().UnixMilli())

			ev := OutputEvent{Data: data, Offset: offset}
			for _, sub := range subs {
				select {
				case sub.ch <- ev:
				case <-sub.done:
				default:
					sub.dropped.Store(true)
				}
			}
		}
		if err != nil {
			if err != io.EOF && !errors.Is(err, os.ErrClosed) {
				log.Printf("pty read error: %v", err)
			}
			code := s.ExitCode()

			s.dispatchMu.Lock()
			s.exited = true
			s.exitC = code
			subs := make([]*subscriber, len(s.subs))
			copy(subs, s.subs)
			s.dispatchMu.Unlock()

			for _, sub := range subs {
				select {
				case sub.ch <- OutputEvent{ExitCode: code}:
				case <-sub.done:
				}
			}
			return
		}
	}
}

// Snapshot returns a self-contained byte sequence reflecting the current
// terminal state (active screen, primary scrollback, active modes, cursor,
// title, cwd). When written to a fresh xterm-class client preceded by
// terminal.reset(), it brings the client into sync regardless of whether the
// client missed earlier setup escapes. The returned offset is the PTY byte
// offset at the moment the snapshot was taken; the caller should use it as
// lastSent for live event filtering. If sub is non-nil, its overflow flag is
// cleared atomically with the snapshot — use this on overflow recovery.
func (s *Session) Snapshot(sub *Subscriber) ([]byte, uint64) {
	s.dispatchMu.Lock()
	defer s.dispatchMu.Unlock()
	if sub != nil {
		sub.dropped.Store(false)
	}
	return s.snapshotLocked(), s.scrollback.Offset()
}

// Subscribe registers a new subscriber and returns:
//   - the snapshot bytes to write after terminal.reset()
//   - the snapshot's PTY byte offset (use as lastSent)
//   - the live event channel
//   - the cancel channel and unsubscribe callback
func (s *Session) Subscribe() (snapshot []byte, currentOffset uint64, events <-chan OutputEvent, canceled <-chan struct{}, sub *Subscriber, unsubscribe func()) {
	s.dispatchMu.Lock()
	defer s.dispatchMu.Unlock()

	sub = &subscriber{
		ch:   make(chan OutputEvent, 256),
		done: make(chan struct{}),
	}

	snapshot = s.snapshotLocked()
	currentOffset = s.scrollback.Offset()
	s.subs = append(s.subs, sub)

	if s.exited {
		exitCode := s.exitC
		go func() {
			select {
			case sub.ch <- OutputEvent{ExitCode: exitCode}:
			case <-sub.done:
			}
		}()
	}

	unsub := func() {
		s.dispatchMu.Lock()
		defer s.dispatchMu.Unlock()
		for i, ss := range s.subs {
			if ss == sub {
				close(sub.done)
				s.subs = append(s.subs[:i], s.subs[i+1:]...)
				break
			}
		}
	}

	return snapshot, currentOffset, sub.ch, sub.done, sub, unsub
}

// altScreenModeNums are emitted explicitly in Phase 2 of the snapshot, NOT in
// the bulk DECSET prelude. These modes switch screen buffers; emitting them
// before the active-screen content is painted would put content in the wrong
// buffer.
var altScreenModeNums = map[int]bool{47: true, 1047: true, 1049: true}

func (s *Session) snapshotLocked() []byte {
	var buf bytes.Buffer

	buf.WriteString("\x1bc")

	if s.title != "" {
		fmt.Fprintf(&buf, "\x1b]0;%s\x07", s.title)
	}
	if s.cwd != "" {
		fmt.Fprintf(&buf, "\x1b]7;%s\x07", s.cwd)
	}

	modeKeys := make([]int, 0, len(s.modes))
	ansiModeKeys := make([]int, 0)
	for m := range s.modes {
		if dm, ok := m.(ansi.DECMode); ok && !altScreenModeNums[int(dm)] {
			modeKeys = append(modeKeys, int(dm))
		} else if am, ok := m.(ansi.ANSIMode); ok {
			ansiModeKeys = append(ansiModeKeys, int(am))
		}
	}
	sort.Ints(modeKeys)
	for _, k := range modeKeys {
		fmt.Fprintf(&buf, "\x1b[?%dh", k)
	}
	sort.Ints(ansiModeKeys)
	for _, k := range ansiModeKeys {
		fmt.Fprintf(&buf, "\x1b[%dh", k)
	}

	// Phase 1: cursor home + linear stream of (scrollback rows) + (primary
	// rows if not on alt-screen, else height padding to scroll scrollback
	// into receiver's scrollback). \r\n only BETWEEN entries, not after the
	// last — a trailing LF would scroll one extra line.
	buf.WriteString("\x1b[1;1H")
	sb := s.emul.Scrollback()
	sbLen := 0
	if sb != nil {
		sbLen = sb.Len()
	}
	stream := make([]string, 0, sbLen+s.emul.Height())
	if sb != nil {
		for i := 0; i < sb.Len(); i++ {
			if line := sb.Line(i); line != nil {
				stream = append(stream, line.Render())
			}
		}
	}
	if !s.altScreen {
		stream = append(stream, strings.Split(s.emul.Render(), "\n")...)
	} else {
		for i := 0; i < s.emul.Height(); i++ {
			stream = append(stream, "")
		}
	}
	for i, line := range stream {
		if i > 0 {
			buf.WriteString("\r\n")
		}
		buf.WriteString(line)
	}

	// Phase 2: enter alt-screen (if active) and paint its rows with explicit
	// positioning.
	if s.altScreen {
		buf.WriteString("\x1b[?1049h")
		for i, line := range strings.Split(s.emul.Render(), "\n") {
			fmt.Fprintf(&buf, "\x1b[%d;1H", i+1)
			buf.WriteString(line)
		}
	}

	cur := s.emul.CursorPosition()
	fmt.Fprintf(&buf, "\x1b[%d;%dH", cur.Y+1, cur.X+1)

	if !s.cursorVis {
		buf.WriteString("\x1b[?25l")
	}

	return buf.Bytes()
}

func (s *Session) ID() string {
	return s.id
}

// LastActivity returns the time of the last PTY output.
func (s *Session) LastActivity() time.Time {
	ms := s.lastActivity.Load()
	if ms == 0 {
		return time.Time{}
	}
	return time.UnixMilli(ms)
}

// Scrollback returns a snapshot of the recent PTY output.
func (s *Session) Scrollback() []byte {
	return s.scrollback.Bytes()
}

func (s *Session) Write(data []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.ptmx.Write(data)
}

// resizeEmulatorLocked applies a resize to the emulator. Caller holds
// dispatchMu. Extracted so tests can exercise the emul-side logic without a
// real PTY.
func (s *Session) resizeEmulatorLocked(rows, cols uint16) {
	s.emul.Resize(int(cols), int(rows))
	// Read s.altScreen AFTER Resize: the resize may itself fire AltScreen
	// callbacks that update the field, and we want the post-resize state.
	// dispatchMu is held, so the read is race-free.
	if s.altScreen {
		// Match the client-side alt-buffer clear in TerminalPane.sendResize. A
		// snapshot taken just after a resize would otherwise carry the old alt
		// rows at their pre-resize coordinates while the app's SIGWINCH redraw
		// only updates new coordinates, leaving ghost rows in the next
		// subscriber's alt buffer.
		_, _ = s.emul.Write([]byte("\x1b[2J\x1b[H"))
	}
}

func (s *Session) Resize(rows, cols uint16) error {
	s.dispatchMu.Lock()
	s.resizeEmulatorLocked(rows, cols)
	s.dispatchMu.Unlock()
	return pty.Setsize(s.ptmx, &pty.Winsize{Rows: rows, Cols: cols})
}

func (s *Session) Done() <-chan struct{} {
	return s.doneCh
}

func (s *Session) ExitCode() int {
	if s.cmd.ProcessState == nil {
		return -1
	}
	return s.cmd.ProcessState.ExitCode()
}

func (s *Session) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cmd.Process != nil {
		_ = s.cmd.Process.Signal(os.Interrupt)
	}
	// Closing ptmx wakes readLoop, which closes the emulator under dispatchMu
	// in its defer. Doing it here would race with the in-flight emul.Write
	// inside readLoop.
	return s.ptmx.Close()
}
