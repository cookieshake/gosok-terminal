package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLite(dbPath string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(wal)&_pragma=foreign_keys(on)")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	s := &SQLiteStore{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return s, nil
}

func (s *SQLiteStore) migrate() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS projects (
			id          TEXT PRIMARY KEY,
			name        TEXT NOT NULL,
			path        TEXT NOT NULL,
			description TEXT DEFAULT '',
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS agents (
			id          TEXT PRIMARY KEY,
			project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name        TEXT NOT NULL,
			agent_type  TEXT NOT NULL,
			command     TEXT NOT NULL,
			args        TEXT DEFAULT '[]',
			env         TEXT DEFAULT '{}',
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`)
	return err
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

// Projects

func (s *SQLiteStore) CreateProject(ctx context.Context, p *Project) error {
	now := time.Now()
	p.CreatedAt = now
	p.UpdatedAt = now
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO projects (id, name, path, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		p.ID, p.Name, p.Path, p.Description, p.CreatedAt, p.UpdatedAt,
	)
	return err
}

func (s *SQLiteStore) GetProject(ctx context.Context, id string) (*Project, error) {
	p := &Project{}
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, path, description, created_at, updated_at FROM projects WHERE id = ?`, id,
	).Scan(&p.ID, &p.Name, &p.Path, &p.Description, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return p, err
}

func (s *SQLiteStore) ListProjects(ctx context.Context) ([]*Project, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, path, description, created_at, updated_at FROM projects ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []*Project
	for rows.Next() {
		p := &Project{}
		if err := rows.Scan(&p.ID, &p.Name, &p.Path, &p.Description, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (s *SQLiteStore) UpdateProject(ctx context.Context, p *Project) error {
	p.UpdatedAt = time.Now()
	_, err := s.db.ExecContext(ctx,
		`UPDATE projects SET name = ?, path = ?, description = ?, updated_at = ? WHERE id = ?`,
		p.Name, p.Path, p.Description, p.UpdatedAt, p.ID,
	)
	return err
}

func (s *SQLiteStore) DeleteProject(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM projects WHERE id = ?`, id)
	return err
}

// Agents

func (s *SQLiteStore) CreateAgent(ctx context.Context, a *Agent) error {
	now := time.Now()
	a.CreatedAt = now
	a.UpdatedAt = now
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO agents (id, project_id, name, agent_type, command, args, env, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.ProjectID, a.Name, a.AgentType, a.Command, a.Args, a.Env, a.CreatedAt, a.UpdatedAt,
	)
	return err
}

func (s *SQLiteStore) GetAgent(ctx context.Context, id string) (*Agent, error) {
	a := &Agent{}
	err := s.db.QueryRowContext(ctx,
		`SELECT id, project_id, name, agent_type, command, args, env, created_at, updated_at FROM agents WHERE id = ?`, id,
	).Scan(&a.ID, &a.ProjectID, &a.Name, &a.AgentType, &a.Command, &a.Args, &a.Env, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return a, err
}

func (s *SQLiteStore) ListAgentsByProject(ctx context.Context, projectID string) ([]*Agent, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, project_id, name, agent_type, command, args, env, created_at, updated_at FROM agents WHERE project_id = ? ORDER BY created_at`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agents []*Agent
	for rows.Next() {
		a := &Agent{}
		if err := rows.Scan(&a.ID, &a.ProjectID, &a.Name, &a.AgentType, &a.Command, &a.Args, &a.Env, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		agents = append(agents, a)
	}
	return agents, rows.Err()
}

func (s *SQLiteStore) UpdateAgent(ctx context.Context, a *Agent) error {
	a.UpdatedAt = time.Now()
	_, err := s.db.ExecContext(ctx,
		`UPDATE agents SET name = ?, agent_type = ?, command = ?, args = ?, env = ?, updated_at = ? WHERE id = ?`,
		a.Name, a.AgentType, a.Command, a.Args, a.Env, a.UpdatedAt, a.ID,
	)
	return err
}

func (s *SQLiteStore) DeleteAgent(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM agents WHERE id = ?`, id)
	return err
}
