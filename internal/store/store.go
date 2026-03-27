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
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Tab struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"project_id"`
	Name      string    `json:"name"`
	Title     string    `json:"title"` // dynamic title from OSC sequences
	TabType   string    `json:"tab_type"`
	Command   string    `json:"command"`
	Args      string    `json:"args"` // JSON array
	Env       string    `json:"env"`  // JSON object
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Message struct {
	ID        string    `json:"id"`
	Scope     string    `json:"scope"`       // "direct", "broadcast", "global"
	FromTabID string    `json:"from_tab_id"` // nullable
	ToTabID   string    `json:"to_tab_id"`   // only for direct
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

type Store interface {
	// Projects
	CreateProject(ctx context.Context, p *Project) error
	GetProject(ctx context.Context, id string) (*Project, error)
	ListProjects(ctx context.Context) ([]*Project, error)
	UpdateProject(ctx context.Context, p *Project) error
	DeleteProject(ctx context.Context, id string) error
	ReorderProjects(ctx context.Context, ids []string) error

	// Tabs
	CreateTab(ctx context.Context, t *Tab) error
	GetTab(ctx context.Context, id string) (*Tab, error)
	ListTabsByProject(ctx context.Context, projectID string) ([]*Tab, error)
	UpdateTab(ctx context.Context, t *Tab) error
	UpdateTabTitle(ctx context.Context, id, title string) error
	DeleteTab(ctx context.Context, id string) error
	ReorderTabs(ctx context.Context, ids []string) error

	Close() error

	// Messages
	CreateMessage(ctx context.Context, m *Message) error
	GetInbox(ctx context.Context, tabID string, since string) ([]*Message, error)
	GetFeed(ctx context.Context, since string) ([]*Message, error)
	UpdateReadMarker(ctx context.Context, tabID, channel, lastReadID string) error
	GetReadMarker(ctx context.Context, tabID, channel string) (string, error)
	PurgeOldMessages(ctx context.Context, before time.Time) (int64, error)

	// Settings
	GetSetting(ctx context.Context, key string) (string, error) // not found → "", nil
	SetSetting(ctx context.Context, key, value string) error    // upsert
	ListSettings(ctx context.Context) (map[string]string, error)
	DeleteSetting(ctx context.Context, key string) error
}
