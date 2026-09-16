package services

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

type BackupStorage struct {
	ID         string            `json:"id"`
	Owner      string            `json:"owner"`
	Name       string            `json:"name"`
	Provider   string            `json:"provider"` // "s3", "r2", "gdrive", "onedrive"
	Bucket     string            `json:"bucket"`
	PathPrefix string            `json:"pathPrefix"`
	IsDefault  bool              `json:"isDefault"`
	Config     map[string]string `json:"config"`
	CreatedAt  time.Time         `json:"createdAt"`
	UpdatedAt  time.Time         `json:"updatedAt"`
}

type BackupStorageService struct {
	db *sql.DB
}

func NewBackupStorageService(db *sql.DB) (*BackupStorageService, error) {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS backup_storages (
		id TEXT PRIMARY KEY,
		owner TEXT NOT NULL,
		name TEXT NOT NULL,
		provider TEXT NOT NULL,
		bucket TEXT NOT NULL DEFAULT '',
		path_prefix TEXT NOT NULL DEFAULT '',
		is_default INTEGER NOT NULL DEFAULT 0,
		config TEXT NOT NULL DEFAULT '{}',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		return nil, err
	}
	_, _ = db.Exec(`UPDATE backup_storages SET owner = 'root' WHERE owner = ''`)
	return &BackupStorageService{db: db}, nil
}

func (s *BackupStorageService) List(owner string) ([]BackupStorage, error) {
	var rows *sql.Rows
	var err error

	if owner == "" {
		rows, err = s.db.Query(`SELECT id, owner, name, provider, bucket, path_prefix, is_default, config, created_at, updated_at FROM backup_storages ORDER BY is_default DESC, name ASC`)
	} else {
		rows, err = s.db.Query(`SELECT id, owner, name, provider, bucket, path_prefix, is_default, config, created_at, updated_at FROM backup_storages WHERE owner = ? ORDER BY is_default DESC, name ASC`, owner)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []BackupStorage
	for rows.Next() {
		var item BackupStorage
		var isDefaultInt int
		var configStr string
		if err := rows.Scan(&item.ID, &item.Owner, &item.Name, &item.Provider, &item.Bucket, &item.PathPrefix, &isDefaultInt, &configStr, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		item.IsDefault = isDefaultInt == 1
		item.Config = make(map[string]string)
		_ = json.Unmarshal([]byte(configStr), &item.Config)
		list = append(list, item)
	}
	return list, rows.Err()
}

func (s *BackupStorageService) Save(item *BackupStorage) error {
	if item.Name == "" {
		return errors.New("name is required")
	}
	if item.Provider == "" {
		return errors.New("provider is required")
	}
	validProviders := map[string]bool{
		"s3":       true,
		"r2":       true,
		"gdrive":   true,
		"onedrive": true,
	}
	if !validProviders[item.Provider] {
		return fmt.Errorf("unsupported provider: %s", item.Provider)
	}

	if item.ID == "" {
		b := make([]byte, 8)
		_, _ = rand.Read(b)
		item.ID = "strg_" + hex.EncodeToString(b)
	}

	if strings.TrimSpace(item.Owner) == "" {
		return errors.New("owner is required")
	}

	if item.Config == nil {
		item.Config = make(map[string]string)
	}
	configBytes, err := json.Marshal(item.Config)
	if err != nil {
		return err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if item.IsDefault {
		if _, err := tx.Exec(`UPDATE backup_storages SET is_default = 0 WHERE owner = ?`, item.Owner); err != nil {
			return err
		}
	}

	isDefInt := 0
	if item.IsDefault {
		isDefInt = 1
	}

	_, err = tx.Exec(`INSERT INTO backup_storages (id, owner, name, provider, bucket, path_prefix, is_default, config, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			provider = excluded.provider,
			bucket = excluded.bucket,
			path_prefix = excluded.path_prefix,
			is_default = excluded.is_default,
			config = excluded.config,
			updated_at = CURRENT_TIMESTAMP`,
		item.ID, item.Owner, item.Name, item.Provider, item.Bucket, item.PathPrefix, isDefInt, string(configBytes),
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *BackupStorageService) Delete(id, owner string) error {
	if owner == "" {
		_, err := s.db.Exec(`DELETE FROM backup_storages WHERE id = ?`, id)
		return err
	}
	_, err := s.db.Exec(`DELETE FROM backup_storages WHERE id = ? AND owner = ?`, id, owner)
	return err
}
