package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	ptyPkg "github.com/cookieshake/gosok-terminal/internal/pty"
	"github.com/cookieshake/gosok-terminal/internal/store"
)

type Service struct {
	store    store.Store
	ptyMgr   *ptyPkg.Manager
	statuses map[string]*AgentStatus // agentID -> status
	mu       sync.RWMutex
}

func NewService(s store.Store, ptyMgr *ptyPkg.Manager) *Service {
	return &Service{
		store:    s,
		ptyMgr:   ptyMgr,
		statuses: make(map[string]*AgentStatus),
	}
}

func (s *Service) Start(ctx context.Context, agentID string) (*AgentStatus, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if already running
	if st, ok := s.statuses[agentID]; ok && st.Status == StatusRunning {
		return st, nil
	}

	// Get agent config from store
	agent, err := s.store.GetAgent(ctx, agentID)
	if err != nil {
		return nil, fmt.Errorf("get agent: %w", err)
	}
	if agent == nil {
		return nil, fmt.Errorf("agent %s not found", agentID)
	}

	// Get project for working directory
	project, err := s.store.GetProject(ctx, agent.ProjectID)
	if err != nil {
		return nil, fmt.Errorf("get project: %w", err)
	}
	if project == nil {
		return nil, fmt.Errorf("project %s not found", agent.ProjectID)
	}

	// Determine command and args
	command := agent.Command
	var args []string
	if err := json.Unmarshal([]byte(agent.Args), &args); err != nil {
		args = nil
	}

	// Parse env
	var envMap map[string]string
	if err := json.Unmarshal([]byte(agent.Env), &envMap); err != nil {
		envMap = nil
	}
	var env []string
	for k, v := range envMap {
		env = append(env, k+"="+v)
	}

	// Create PTY session
	session, err := s.ptyMgr.Create(command, args, project.Path, env, 24, 80)
	if err != nil {
		return nil, fmt.Errorf("create pty: %w", err)
	}

	st := &AgentStatus{
		AgentID:   agentID,
		Status:    StatusRunning,
		SessionID: session.ID(),
	}
	s.statuses[agentID] = st

	// Watch for exit
	go func() {
		<-session.Done()
		s.mu.Lock()
		if cur, ok := s.statuses[agentID]; ok && cur.SessionID == session.ID() {
			cur.Status = StatusStopped
			cur.SessionID = ""
		}
		s.mu.Unlock()
	}()

	return st, nil
}

func (s *Service) Stop(_ context.Context, agentID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	st, ok := s.statuses[agentID]
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

func (s *Service) Restart(ctx context.Context, agentID string) (*AgentStatus, error) {
	if err := s.Stop(ctx, agentID); err != nil {
		return nil, err
	}
	return s.Start(ctx, agentID)
}

func (s *Service) GetStatus(agentID string) AgentStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if st, ok := s.statuses[agentID]; ok {
		return *st
	}
	return AgentStatus{AgentID: agentID, Status: StatusStopped}
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
