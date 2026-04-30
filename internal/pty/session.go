package pty

import (
	"errors"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"
	"time"

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

	// dispatchMu serializes scrollback writes with subscriber list mutations.
	// Holding it guarantees that any write either lands in a snapshot returned
	// by Subscribe/Resync (and is NOT delivered as an event) or lands in the
	// event channel (and is NOT in the snapshot) — never both.
	dispatchMu sync.Mutex
	subs       []*subscriber
	exited     bool
	exitC      int
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
	}

	go func() {
		_ = cmd.Wait()
		close(s.doneCh)
	}()

	// Single persistent PTY reader — captures to scrollback and forwards to subscriber.
	go s.readLoop()

	return s, nil
}

func (s *Session) readLoop() {
	buf := make([]byte, 32*1024)
	for {
		n, err := s.ptmx.Read(buf)
		if n > 0 {
			data := make([]byte, n)
			copy(data, buf[:n])

			s.dispatchMu.Lock()
			_, _ = s.scrollback.Write(data)
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

// Subscribe returns scrollback data, current offset, an output event channel,
// a cancel channel, and an unsubscribe function.
// If clientOffset > 0, only the delta since that offset is returned (and
// fullReplay is false). When the client is too far behind or connecting for
// the first time (clientOffset == 0), the full buffer is returned with
// fullReplay == true so the client knows to reset its display.
// Resync returns the bytes between lastSent and the current offset, intended
// for a subscriber that fell behind. The caller is the source of truth for
// what has actually been delivered to the client; pass the offset of the last
// successful WS write.
func (s *Session) Resync(sub *Subscriber, lastSent uint64) ([]byte, uint64) {
	s.dispatchMu.Lock()
	defer s.dispatchMu.Unlock()
	sub.dropped.Store(false)
	data, currentOffset, _ := s.scrollback.BytesSince(lastSent)
	return data, currentOffset
}

func (s *Session) Subscribe(clientOffset uint64) (data []byte, currentOffset uint64, fullReplay bool, events <-chan OutputEvent, canceled <-chan struct{}, sub *Subscriber, unsubscribe func()) {
	s.dispatchMu.Lock()
	defer s.dispatchMu.Unlock()

	sub = &subscriber{
		ch:   make(chan OutputEvent, 256),
		done: make(chan struct{}),
	}

	if clientOffset == 0 {
		data = s.scrollback.Bytes()
		currentOffset = s.scrollback.Offset()
		fullReplay = true
	} else {
		data, currentOffset, fullReplay = s.scrollback.BytesSince(clientOffset)
	}
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

	return data, currentOffset, fullReplay, sub.ch, sub.done, sub, unsub
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

func (s *Session) Resize(rows, cols uint16) error {
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
	return s.ptmx.Close()
}
