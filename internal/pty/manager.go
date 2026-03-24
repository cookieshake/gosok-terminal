package pty

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/oklog/ulid/v2"
)

type Manager struct {
	sessions map[string]*Session
	mu       sync.RWMutex
	entropy  *rand.Rand
}

func NewManager() *Manager {
	return &Manager{
		sessions: make(map[string]*Session),
		entropy:  rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (m *Manager) Create(command string, args []string, dir string, env []string, rows, cols uint16) (*Session, error) {
	id := ulid.MustNew(ulid.Timestamp(time.Now()), m.entropy).String()

	s, err := newSession(id, command, args, dir, env, rows, cols)
	if err != nil {
		return nil, fmt.Errorf("create pty session: %w", err)
	}

	m.mu.Lock()
	m.sessions[id] = s
	m.mu.Unlock()

	// Auto-cleanup when process exits
	go func() {
		<-s.Done()
		m.mu.Lock()
		delete(m.sessions, id)
		m.mu.Unlock()
	}()

	return s, nil
}

func (m *Manager) Get(id string) (*Session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[id]
	return s, ok
}

func (m *Manager) Destroy(id string) error {
	m.mu.Lock()
	s, ok := m.sessions[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("session %s not found", id)
	}
	delete(m.sessions, id)
	m.mu.Unlock()

	return s.Close()
}

func (m *Manager) List() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}
	return ids
}

func (m *Manager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, s := range m.sessions {
		_ = s.Close()
		delete(m.sessions, id)
	}
}
