package store

import (
	"context"
	"time"
)

type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Agent struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"project_id"`
	Name      string    `json:"name"`
	AgentType string    `json:"agent_type"`
	Command   string    `json:"command"`
	Args      string    `json:"args"` // JSON array
	Env       string    `json:"env"`  // JSON object
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Store interface {
	// Projects
	CreateProject(ctx context.Context, p *Project) error
	GetProject(ctx context.Context, id string) (*Project, error)
	ListProjects(ctx context.Context) ([]*Project, error)
	UpdateProject(ctx context.Context, p *Project) error
	DeleteProject(ctx context.Context, id string) error

	// Agents
	CreateAgent(ctx context.Context, a *Agent) error
	GetAgent(ctx context.Context, id string) (*Agent, error)
	ListAgentsByProject(ctx context.Context, projectID string) ([]*Agent, error)
	UpdateAgent(ctx context.Context, a *Agent) error
	DeleteAgent(ctx context.Context, id string) error

	Close() error
}
