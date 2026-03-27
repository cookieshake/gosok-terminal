package tab

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"

	ptyPkg "github.com/cookieshake/gosok-terminal/internal/pty"
	"github.com/cookieshake/gosok-terminal/internal/store"
)

type Service struct {
	store    store.Store
	ptyMgr   *ptyPkg.Manager
	statuses map[string]*TabStatus // tabID -> status
	mu       sync.RWMutex
}

func NewService(s store.Store, ptyMgr *ptyPkg.Manager) *Service {
	return &Service{
		store:    s,
		ptyMgr:   ptyMgr,
		statuses: make(map[string]*TabStatus),
	}
}

func (s *Service) Start(ctx context.Context, tabID string) (*TabStatus, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if already running
	if st, ok := s.statuses[tabID]; ok && st.Status == StatusRunning {
		return st, nil
	}

	// Get tab config from store
	tab, err := s.store.GetTab(ctx, tabID)
	if err != nil {
		return nil, fmt.Errorf("get tab: %w", err)
	}
	if tab == nil {
		return nil, fmt.Errorf("tab %s not found", tabID)
	}

	// Get project for working directory
	project, err := s.store.GetProject(ctx, tab.ProjectID)
	if err != nil {
		return nil, fmt.Errorf("get project: %w", err)
	}
	if project == nil {
		return nil, fmt.Errorf("project %s not found", tab.ProjectID)
	}

	// Determine command and args
	command := tab.Command
	var args []string
	if err := json.Unmarshal([]byte(tab.Args), &args); err != nil {
		args = nil
	}

	// Parse env
	var envMap map[string]string
	if err := json.Unmarshal([]byte(tab.Env), &envMap); err != nil {
		envMap = nil
	}
	var env []string
	for k, v := range envMap {
		env = append(env, k+"="+v)
	}

	// Inject gosok environment variables
	port := os.Getenv("GOSOK_PORT")
	if port == "" {
		port = "18435"
	}
	env = append(env,
		"GOSOK_TAB_ID="+tabID,
		"GOSOK_API_URL=http://localhost:"+port,
	)

	// Create PTY session
	session, err := s.ptyMgr.Create(command, args, project.Path, env, 24, 80)
	if err != nil {
		return nil, fmt.Errorf("create pty: %w", err)
	}

	st := &TabStatus{
		TabID:     tabID,
		Status:    StatusRunning,
		SessionID: session.ID(),
	}
	s.statuses[tabID] = st

	// Watch for exit
	go func() {
		<-session.Done()
		s.mu.Lock()
		if cur, ok := s.statuses[tabID]; ok && cur.SessionID == session.ID() {
			cur.Status = StatusStopped
			cur.SessionID = ""
		}
		s.mu.Unlock()
	}()

	return st, nil
}

func (s *Service) Stop(_ context.Context, tabID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	st, ok := s.statuses[tabID]
	if !ok || st.Status != StatusRunning {
		return nil
	}

	if err := s.ptyMgr.Destroy(st.SessionID); err != nil {
		return fmt.Errorf("destroy pty: %w", err)
	}

	st.Status = StatusStopped
	st.SessionID = ""
	return nil
}

func (s *Service) Restart(ctx context.Context, tabID string) (*TabStatus, error) {
	if err := s.Stop(ctx, tabID); err != nil {
		return nil, err
	}
	return s.Start(ctx, tabID)
}

func (s *Service) GetStatus(tabID string) TabStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	st, ok := s.statuses[tabID]
	if !ok {
		return TabStatus{TabID: tabID, Status: StatusStopped}
	}

	result := *st
	if st.SessionID != "" {
		if session, ok := s.ptyMgr.Get(st.SessionID); ok {
			if t := session.LastActivity(); !t.IsZero() {
				result.LastActivity = t.UnixMilli()
			}
		}
	}
	return result
}

func (s *Service) StopAll(ctx context.Context) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, st := range s.statuses {
		if st.Status == StatusRunning && st.SessionID != "" {
			_ = s.ptyMgr.Destroy(st.SessionID)
			st.Status = StatusStopped
			st.SessionID = ""
		}
	}
}
