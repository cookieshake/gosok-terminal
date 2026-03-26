package pty

import (
	"errors"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
)

const scrollbackSize = 1 << 20 // 1 MiB

// OutputEvent represents data from the PTY or a process exit.
type OutputEvent struct {
	Data     []byte // PTY output; nil on exit
	ExitCode int    // valid only when Data is nil
}

type subscriber struct {
	ch   chan OutputEvent
	done chan struct{} // closed on unsubscribe or replaced
}

type Session struct {
	id         string
	cmd        *exec.Cmd
	ptmx       *os.File
	mu         sync.Mutex // protects ptmx writes
	doneCh     chan struct{}
	scrollback *ringBuffer

	subMu  sync.Mutex
	curSub *subscriber
	exited bool
	exitC  int
}

func newSession(id, command string, args []string, dir string, env []string, rows, cols uint16) (*Session, error) {
	cmd := exec.Command(command, args...)
	if dir != "" {
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			cmd.Dir = dir
		}
	}
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
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
			_, _ = s.scrollback.Write(data)
			s.emit(OutputEvent{Data: data})
		}
		if err != nil {
			if err != io.EOF && !errors.Is(err, os.ErrClosed) {
				log.Printf("pty read error: %v", err)
			}
			code := s.ExitCode()
			s.subMu.Lock()
			s.exited = true
			s.exitC = code
			sub := s.curSub
			s.subMu.Unlock()

			if sub != nil {
				select {
				case sub.ch <- OutputEvent{ExitCode: code}:
				case <-sub.done:
				}
			}
			return
		}
	}
}

func (s *Session) emit(ev OutputEvent) {
	s.subMu.Lock()
	sub := s.curSub
	s.subMu.Unlock()

	if sub == nil {
		return
	}

	select {
	case sub.ch <- ev:
	case <-sub.done:
	default:
		// drop — data is safe in scrollback
	}
}

// Subscribe returns the current scrollback, an output event channel, a cancel
// channel (closed when this subscription is superseded or unsubscribed), and
// an unsubscribe function. Only one subscriber is active at a time; calling
// Subscribe again cancels the previous subscriber.
func (s *Session) Subscribe() (scrollback []byte, events <-chan OutputEvent, canceled <-chan struct{}, unsubscribe func()) {
	s.subMu.Lock()
	defer s.subMu.Unlock()

	// Kick previous subscriber
	if s.curSub != nil {
		close(s.curSub.done)
		s.curSub = nil
	}

	sub := &subscriber{
		ch:   make(chan OutputEvent, 8),
		done: make(chan struct{}),
	}
	s.curSub = sub

	snap := s.scrollback.Bytes()

	// If process already exited, deliver exit event immediately
	if s.exited {
		go func() {
			select {
			case sub.ch <- OutputEvent{ExitCode: s.exitC}:
			case <-sub.done:
			}
		}()
	}

	unsub := func() {
		s.subMu.Lock()
		defer s.subMu.Unlock()
		if s.curSub == sub {
			close(sub.done)
			s.curSub = nil
		}
	}

	return snap, sub.ch, sub.done, unsub
}

func (s *Session) ID() string {
	return s.id
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
