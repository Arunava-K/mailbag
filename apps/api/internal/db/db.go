package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"mailbag/internal/config"

	_ "github.com/tursodatabase/libsql-client-go/libsql"
	_ "modernc.org/sqlite"
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
		path := filepath.Join(cfg.DataDir, "mailbag.db")
		database, err = sql.Open("sqlite", path)
		if err != nil {
			return nil, err
		}
		database.SetMaxOpenConns(1)
	}
	if err := EnsureSchema(database); err != nil {
		return nil, err
	}
	return database, nil
}

// EnsureSchema creates tables if missing. Open calls it; tests use it directly
// on a throwaway database.
func EnsureSchema(database *sql.DB) error {
	for _, s := range statements {
		if _, err := database.Exec(s); err != nil {
			return fmt.Errorf("schema: %w", err)
		}
	}
	return addColumnIfMissing(database, "contacts", "unsubscribed_at", "DATETIME")
}

// addColumnIfMissing is an idempotent ALTER TABLE ADD COLUMN: existing local
// SQLite and Turso databases already have the table, and SQLite has no
// "ADD COLUMN IF NOT EXISTS". The column is nullable.
func addColumnIfMissing(database *sql.DB, table, column, decl string) error {
	rows, err := database.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return fmt.Errorf("schema: table_info: %w", err)
	}
	found := false
	for rows.Next() {
		var cid, notnull, pk int
		var name, typ string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			return fmt.Errorf("schema: table_info scan: %w", err)
		}
		if strings.EqualFold(name, column) {
			found = true
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return fmt.Errorf("schema: table_info: %w", err)
	}
	rows.Close() // release the connection before the ALTER (SQLite uses one)
	if found {
		return nil
	}
	if _, err := database.Exec(`ALTER TABLE ` + table + ` ADD COLUMN ` + column + ` ` + decl); err != nil {
		return fmt.Errorf("schema: add %s.%s: %w", table, column, err)
	}
	return nil
}

// PurgeExpiredTokens removes confirm tokens past their expiry. Only confirmed
// tokens are deleted during normal operation, so everything else would pile
// up forever without this. main runs it at boot and hourly.
func PurgeExpiredTokens(database *sql.DB) {
	_, _ = database.Exec(`DELETE FROM tokens WHERE expires_at <= CURRENT_TIMESTAMP`)
}
