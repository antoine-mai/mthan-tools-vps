package services

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"sync"

	_ "github.com/mattn/go-sqlite3"
)

const settingsDBEnv = "SETTINGS_DB_PATH"

type SettingsService struct {
	db        *sql.DB
	mu        sync.RWMutex
	rootRoute string
}

func NewSettingsService() (*SettingsService, error) {
	path := settingsDBPath()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite3", path+"?_busy_timeout=5000&_journal_mode=WAL")
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		_ = db.Close()
		return nil, err
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS apis (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		key_hash TEXT NOT NULL UNIQUE,
		key_prefix TEXT NOT NULL,
		accepted_ips TEXT NOT NULL DEFAULT '[]',
		enabled INTEGER NOT NULL DEFAULT 1,
		last_used_at DATETIME,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		_ = db.Close()
		return nil, err
	}
	if _, err := db.Exec(`ALTER TABLE apis ADD COLUMN accepted_ips TEXT NOT NULL DEFAULT '[]'`); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
		_ = db.Close()
		return nil, err
	}
	for oldKey, newKey := range map[string]string{
		"app_name": "general_app_name", "color_mode": "general_color_mode", "header_apps": "apps_header",
	} {
		if _, err := db.Exec(`INSERT OR IGNORE INTO settings (key, value)
			SELECT ?, value FROM settings WHERE key = ?`, newKey, oldKey); err != nil {
			_ = db.Close()
			return nil, err
		}
	}
	for key, value := range map[string]string{
		"general_app_name":    "MTHAN VPS",
		"general_color_mode":  "system",
		"general_root_route":  "/root",
		"apps_header":         "[]",
		"users_default_shell": "/bin/bash",
		"users_home_base":     "/home",
		"users_create_home":   "true",
		"users_auto_username": "false",
	} {
		if _, err := db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", key, value); err != nil {
			_ = db.Close()
			return nil, err
		}
	}
	_, _ = db.Exec("UPDATE settings SET value = 'MTHAN VPS' WHERE key = 'general_app_name' AND value IN ('MThan VPS Panel', 'MThan VPS')")

	var initialRootRoute string
	_ = db.QueryRow("SELECT value FROM settings WHERE key = 'general_root_route'").Scan(&initialRootRoute)
	if initialRootRoute == "" {
		initialRootRoute = "/root"
	}
	initialRootRoute = CleanRoutePrefix(initialRootRoute)

	return &SettingsService{
		db:        db,
		rootRoute: initialRootRoute,
	}, nil
}

func (s *SettingsService) All() (map[string]string, error) {
	rows, err := s.db.Query("SELECT key, value FROM settings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	settings := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		settings[key] = value
	}
	return settings, rows.Err()
}

func (s *SettingsService) Set(key, value string) error {
	_, err := s.db.Exec(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`, key, value)
	if err == nil && key == "general_root_route" {
		s.mu.Lock()
		s.rootRoute = CleanRoutePrefix(value)
		s.mu.Unlock()
	}
	return err
}

func (s *SettingsService) RootRoute() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.rootRoute == "" {
		return "/root"
	}
	return s.rootRoute
}

func CleanRoutePrefix(p string) string {
	p = strings.TrimSpace(p)
	if p == "" {
		return "/root"
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	p = strings.TrimRight(p, "/")
	if p == "" || p == "/" {
		return "/root"
	}
	return p
}

func IsReservedRoutePrefix(name string) bool {
	lower := strings.ToLower(strings.Trim(name, "/"))
	if lower == "root" {
		return false
	}
	reserved := map[string]bool{
		"api":        true,
		"post":       true,
		"login":      true,
		"apps":       true,
		"containers": true,
		"files":      true,
		"vhosts":     true,
		"tasking":    true,
		"backup":     true,
		"agent":      true,
		"settings":   true,
		"apis":       true,
		"terminal":   true,
		"users":      true,
	}
	return reserved[lower]
}

func (s *SettingsService) Get(key, fallback string) string {
	var value string
	if err := s.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value); err != nil {
		return fallback
	}
	return value
}

func (s *SettingsService) DB() *sql.DB {
	return s.db
}

func settingsDBPath() string {
	if path := os.Getenv(settingsDBEnv); path != "" {
		return path
	}
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return filepath.Join(os.TempDir(), ".mthan-vps", "data", "db.sqlite")
	}
	return filepath.Join(home, ".mthan-vps", "data", "db.sqlite")
}
