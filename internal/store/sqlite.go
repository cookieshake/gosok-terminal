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

		CREATE TABLE IF NOT EXISTS tabs (
			id          TEXT PRIMARY KEY,
			project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name        TEXT NOT NULL,
			tab_type    TEXT NOT NULL,
			command     TEXT NOT NULL,
			args        TEXT DEFAULT '[]',
			env         TEXT DEFAULT '{}',
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Migrate from old agents table if it exists
		INSERT OR IGNORE INTO tabs (id, project_id, name, tab_type, command, args, env, created_at, updated_at)
			SELECT id, project_id, name, agent_type, command, args, env, created_at, updated_at
			FROM agents WHERE 1=1;
	`)
	if err != nil {
		// If agents table doesn't exist, the INSERT will fail — that's fine
		_, err = s.db.Exec(`
			CREATE TABLE IF NOT EXISTS projects (
				id          TEXT PRIMARY KEY,
				name        TEXT NOT NULL,
				path        TEXT NOT NULL,
				description TEXT DEFAULT '',
				created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
			);

			CREATE TABLE IF NOT EXISTS tabs (
				id          TEXT PRIMARY KEY,
				project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
				name        TEXT NOT NULL,
				tab_type    TEXT NOT NULL,
				command     TEXT NOT NULL,
				args        TEXT DEFAULT '[]',
				env         TEXT DEFAULT '{}',
				created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`)
	}
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

// Tabs

func (s *SQLiteStore) CreateTab(ctx context.Context, t *Tab) error {
	now := time.Now()
	t.CreatedAt = now
	t.UpdatedAt = now
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO tabs (id, project_id, name, tab_type, command, args, env, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.ProjectID, t.Name, t.TabType, t.Command, t.Args, t.Env, t.CreatedAt, t.UpdatedAt,
	)
	return err
}

func (s *SQLiteStore) GetTab(ctx context.Context, id string) (*Tab, error) {
	t := &Tab{}
	err := s.db.QueryRowContext(ctx,
		`SELECT id, project_id, name, tab_type, command, args, env, created_at, updated_at FROM tabs WHERE id = ?`, id,
	).Scan(&t.ID, &t.ProjectID, &t.Name, &t.TabType, &t.Command, &t.Args, &t.Env, &t.CreatedAt, &t.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return t, err
}

func (s *SQLiteStore) ListTabsByProject(ctx context.Context, projectID string) ([]*Tab, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, project_id, name, tab_type, command, args, env, created_at, updated_at FROM tabs WHERE project_id = ? ORDER BY created_at`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tabs []*Tab
	for rows.Next() {
		t := &Tab{}
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.TabType, &t.Command, &t.Args, &t.Env, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tabs = append(tabs, t)
	}
	return tabs, rows.Err()
}

func (s *SQLiteStore) UpdateTab(ctx context.Context, t *Tab) error {
	t.UpdatedAt = time.Now()
	_, err := s.db.ExecContext(ctx,
		`UPDATE tabs SET name = ?, tab_type = ?, command = ?, args = ?, env = ?, updated_at = ? WHERE id = ?`,
		t.Name, t.TabType, t.Command, t.Args, t.Env, t.UpdatedAt, t.ID,
	)
	return err
}

func (s *SQLiteStore) DeleteTab(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM tabs WHERE id = ?`, id)
	return err
}
