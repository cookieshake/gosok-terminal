package pty

import (
	"io"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
)

type Session struct {
	id   string
	cmd  *exec.Cmd
	ptmx *os.File
	mu   sync.Mutex
	done chan struct{}
}

func newSession(id, command string, args []string, dir string, env []string, rows, cols uint16) (*Session, error) {
	cmd := exec.Command(command, args...)
	// Use working directory if it exists, otherwise fall back to home
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
		id:   id,
		cmd:  cmd,
		ptmx: ptmx,
		done: make(chan struct{}),
	}

	go func() {
		_ = cmd.Wait()
		close(s.done)
	}()

	return s, nil
}

func (s *Session) ID() string {
	return s.id
}

func (s *Session) Read(buf []byte) (int, error) {
	return s.ptmx.Read(buf)
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
	return s.done
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

// WriteTo copies PTY output to the given writer. Blocks until PTY closes.
func (s *Session) WriteTo(w io.Writer) (int64, error) {
	return io.Copy(w, s.ptmx)
}
