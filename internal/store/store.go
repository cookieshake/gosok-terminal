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

type Tab struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"project_id"`
	Name      string    `json:"name"`
	TabType   string    `json:"tab_type"`
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

	// Tabs
	CreateTab(ctx context.Context, t *Tab) error
	GetTab(ctx context.Context, id string) (*Tab, error)
	ListTabsByProject(ctx context.Context, projectID string) ([]*Tab, error)
	UpdateTab(ctx context.Context, t *Tab) error
	DeleteTab(ctx context.Context, id string) error

	Close() error

	// Settings
	GetSetting(ctx context.Context, key string) (string, error) // not found → "", nil
	SetSetting(ctx context.Context, key, value string) error    // upsert
	ListSettings(ctx context.Context) (map[string]string, error)
	DeleteSetting(ctx context.Context, key string) error
}
