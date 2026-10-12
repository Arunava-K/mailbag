package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"mailcollector/internal/config"

	_ "modernc.org/sqlite"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

var statements = []string{
	`CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'newsletter',
  sender_name TEXT NOT NULL DEFAULT '',
  sender_email TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'smtp',
  welcome_subject TEXT NOT NULL DEFAULT '',
  welcome_body TEXT NOT NULL DEFAULT '',
  confirm_redirect TEXT NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
	`CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  position INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  confirmed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(list_id, email)
)`,
	`CREATE INDEX IF NOT EXISTS idx_contacts_list ON contacts(list_id)`,
	`CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
}

// Open uses Turso when TURSO_DATABASE_URL is set, else local SQLite file.
// Keeps database/sql so handlers stay unchanged.
func Open(cfg config.Config) (*sql.DB, error) {
	var database *sql.DB
	var err error
	if cfg.TursoURL != "" {
		url := strings.TrimSpace(cfg.TursoURL)
		// libsql driver expects authToken as query param.
		if cfg.TursoToken != "" && !strings.Contains(url, "authToken=") {
			sep := "?"
			if strings.Contains(url, "?") {
				sep = "&"
			}
			url += sep + "authToken=" + cfg.TursoToken
		}
		database, err = sql.Open("libsql", url)
		if err != nil {
			return nil, err
		}
		database.SetMaxOpenConns(10)
	} else {
		if err := os.MkdirAll(cfg.DataDir, 0o755); err != nil {
			return nil, err
		}
		path := filepath.Join(cfg.DataDir, "collector.db")
		database, err = sql.Open("sqlite", path)
		if err != nil {
			return nil, err
		}
		database.SetMaxOpenConns(1)
	}
	for _, s := range statements {
		if _, err := database.Exec(s); err != nil {
			return nil, fmt.Errorf("schema: %w", err)
		}
	}
	return database, nil
}
