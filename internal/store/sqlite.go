package store

import (
	"context"
	"database/sql"
	"errors"
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

// migrate creates required tables. The two-block structure handles optional
// migration from a legacy "agents" table; if that migration fails (e.g., table
// doesn't exist), the fallback block runs without it. A genuine DB error on
// the second block is returned to the caller.
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

		CREATE TABLE IF NOT EXISTS settings (
			key        TEXT PRIMARY KEY,
			value      TEXT NOT NULL,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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

			CREATE TABLE IF NOT EXISTS settings (
				key        TEXT PRIMARY KEY,
				value      TEXT NOT NULL,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			);
		`)
	}
	// Incremental migrations
	_, _ = s.db.Exec(`ALTER TABLE tabs ADD COLUMN title TEXT NOT NULL DEFAULT ''`)
	_, _ = s.db.Exec(`ALTER TABLE projects ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`)
	_, _ = s.db.Exec(`ALTER TABLE tabs ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`)

	// Messages & read markers
	_, _ = s.db.Exec(`
		CREATE TABLE IF NOT EXISTS messages (
			id          TEXT PRIMARY KEY,
			scope       TEXT NOT NULL,
			from_tab_id TEXT,
			to_tab_id   TEXT,
			body        TEXT NOT NULL,
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_messages_scope ON messages(scope);
		CREATE INDEX IF NOT EXISTS idx_messages_to_tab ON messages(to_tab_id);
		CREATE TABLE IF NOT EXISTS message_reads (
			tab_id       TEXT NOT NULL,
			channel      TEXT NOT NULL,
			last_read_id TEXT NOT NULL,
			PRIMARY KEY (tab_id, channel)
		);
	`)

	// Seed default shortcuts if not set
	var count int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM settings WHERE key = 'shortcuts'`).Scan(&count)
	if count == 0 {
		_, _ = s.db.Exec(`INSERT INTO settings (key, value) VALUES ('shortcuts', '[{"label":"claude-code","command":"claude --dangerously-skip-permissions\n","enabled":true}]')`)
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
		`INSERT INTO projects (id, name, path, description, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order)+1, 0) FROM projects), ?, ?)`,
		p.ID, p.Name, p.Path, p.Description, p.CreatedAt, p.UpdatedAt,
	)
	return err
}

func (s *SQLiteStore) GetProject(ctx context.Context, id string) (*Project, error) {
	p := &Project{}
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, path, description, sort_order, created_at, updated_at FROM projects WHERE id = ?`, id,
	).Scan(&p.ID, &p.Name, &p.Path, &p.Description, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return p, err
}

func (s *SQLiteStore) ListProjects(ctx context.Context) ([]*Project, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, path, description, sort_order, created_at, updated_at FROM projects ORDER BY sort_order, created_at`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []*Project
	for rows.Next() {
		p := &Project{}
		if err := rows.Scan(&p.ID, &p.Name, &p.Path, &p.Description, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt); err != nil {
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

func (s *SQLiteStore) ReorderProjects(ctx context.Context, ids []string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck
	for i, id := range ids {
		if _, err := tx.ExecContext(ctx, `UPDATE projects SET sort_order = ? WHERE id = ?`, i, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// Tabs

func (s *SQLiteStore) CreateTab(ctx context.Context, t *Tab) error {
	now := time.Now()
	t.CreatedAt = now
	t.UpdatedAt = now
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO tabs (id, project_id, name, title, tab_type, command, args, env, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order)+1, 0) FROM tabs WHERE project_id = ?), ?, ?)`,
		t.ID, t.ProjectID, t.Name, t.Title, t.TabType, t.Command, t.Args, t.Env, t.ProjectID, t.CreatedAt, t.UpdatedAt,
	)
	return err
}

func (s *SQLiteStore) GetTab(ctx context.Context, id string) (*Tab, error) {
	t := &Tab{}
	err := s.db.QueryRowContext(ctx,
		`SELECT id, project_id, name, title, tab_type, command, args, env, sort_order, created_at, updated_at FROM tabs WHERE id = ?`, id,
	).Scan(&t.ID, &t.ProjectID, &t.Name, &t.Title, &t.TabType, &t.Command, &t.Args, &t.Env, &t.SortOrder, &t.CreatedAt, &t.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return t, err
}

func (s *SQLiteStore) ListTabsByProject(ctx context.Context, projectID string) ([]*Tab, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, project_id, name, title, tab_type, command, args, env, sort_order, created_at, updated_at FROM tabs WHERE project_id = ? ORDER BY sort_order, created_at`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tabs []*Tab
	for rows.Next() {
		t := &Tab{}
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Title, &t.TabType, &t.Command, &t.Args, &t.Env, &t.SortOrder, &t.CreatedAt, &t.UpdatedAt); err != nil {
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

func (s *SQLiteStore) UpdateTabTitle(ctx context.Context, id, title string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE tabs SET title = ? WHERE id = ?`,
		title, id,
	)
	return err
}

func (s *SQLiteStore) DeleteTab(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM tabs WHERE id = ?`, id)
	return err
}

func (s *SQLiteStore) ReorderTabs(ctx context.Context, ids []string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck
	for i, id := range ids {
		if _, err := tx.ExecContext(ctx, `UPDATE tabs SET sort_order = ? WHERE id = ?`, i, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// Settings

func (s *SQLiteStore) GetSetting(ctx context.Context, key string) (string, error) {
	var value string
	err := s.db.QueryRowContext(ctx,
		`SELECT value FROM settings WHERE key = ?`, key,
	).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return value, err
}

func (s *SQLiteStore) SetSetting(ctx context.Context, key, value string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
		key, value,
	)
	return err
}

func (s *SQLiteStore) ListSettings(ctx context.Context) (map[string]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		result[k] = v
	}
	return result, rows.Err()
}

func (s *SQLiteStore) DeleteSetting(ctx context.Context, key string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM settings WHERE key = ?`, key)
	return err
}

// Messages

func (s *SQLiteStore) CreateMessage(ctx context.Context, m *Message) error {
	m.CreatedAt = time.Now()
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO messages (id, scope, from_tab_id, to_tab_id, body, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		m.ID, m.Scope, m.FromTabID, m.ToTabID, m.Body, m.CreatedAt,
	)
	return err
}

func (s *SQLiteStore) GetInbox(ctx context.Context, tabID string, since string) ([]*Message, error) {
	query := `SELECT id, scope, from_tab_id, to_tab_id, body, created_at FROM messages
		WHERE (scope = 'direct' AND to_tab_id = ?) OR scope = 'broadcast'`
	args := []any{tabID}
	if since != "" {
		query += ` AND id > ?`
		args = append(args, since)
	}
	query += ` ORDER BY created_at ASC`

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMessages(rows)
}

func (s *SQLiteStore) GetFeed(ctx context.Context, since string) ([]*Message, error) {
	query := `SELECT id, scope, from_tab_id, to_tab_id, body, created_at FROM messages
		WHERE scope = 'global'`
	var args []any
	if since != "" {
		query += ` AND id > ?`
		args = append(args, since)
	}
	query += ` ORDER BY created_at ASC`

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMessages(rows)
}

func (s *SQLiteStore) UpdateReadMarker(ctx context.Context, tabID, channel, lastReadID string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO message_reads (tab_id, channel, last_read_id) VALUES (?, ?, ?)
		 ON CONFLICT(tab_id, channel) DO UPDATE SET last_read_id = excluded.last_read_id`,
		tabID, channel, lastReadID,
	)
	return err
}

func (s *SQLiteStore) GetReadMarker(ctx context.Context, tabID, channel string) (string, error) {
	var id string
	err := s.db.QueryRowContext(ctx,
		`SELECT last_read_id FROM message_reads WHERE tab_id = ? AND channel = ?`,
		tabID, channel,
	).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return id, err
}

func (s *SQLiteStore) PurgeOldMessages(ctx context.Context, before time.Time) (int64, error) {
	res, err := s.db.ExecContext(ctx, `DELETE FROM messages WHERE created_at < ?`, before)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func scanMessages(rows *sql.Rows) ([]*Message, error) {
	var msgs []*Message
	for rows.Next() {
		m := &Message{}
		if err := rows.Scan(&m.ID, &m.Scope, &m.FromTabID, &m.ToTabID, &m.Body, &m.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, rows.Err()
}
