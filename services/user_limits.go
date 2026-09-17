package services

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

type UserLimits struct {
	Username      string    `json:"username"`
	MaxTasks      int       `json:"maxTasks"`      // <= 0 means unlimited
	MaxContainers int       `json:"maxContainers"` // <= 0 means unlimited
	UpdatedAt     time.Time `json:"updatedAt"`
}

const (
	DefaultMaxTasks      = 10
	DefaultMaxContainers = 5
)

type UserLimitsService struct {
	db *sql.DB
}

func NewUserLimitsService(db *sql.DB) (*UserLimitsService, error) {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS user_limits (
		username TEXT PRIMARY KEY,
		max_tasks INTEGER NOT NULL DEFAULT 10,
		max_containers INTEGER NOT NULL DEFAULT 5,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		return nil, err
	}
	return &UserLimitsService{db: db}, nil
}

func (s *UserLimitsService) Get(username string) (UserLimits, error) {
	username = strings.TrimSpace(username)
	if username == "" {
		return UserLimits{}, errors.New("username is required")
	}

	var limits UserLimits
	err := s.db.QueryRow(`SELECT username, max_tasks, max_containers, updated_at FROM user_limits WHERE username = ?`, username).
		Scan(&limits.Username, &limits.MaxTasks, &limits.MaxContainers, &limits.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return UserLimits{
			Username:      username,
			MaxTasks:      DefaultMaxTasks,
			MaxContainers: DefaultMaxContainers,
			UpdatedAt:     time.Now(),
		}, nil
	}
	if err != nil {
		return UserLimits{}, err
	}
	return limits, nil
}

func (s *UserLimitsService) Set(limits UserLimits) error {
	limits.Username = strings.TrimSpace(limits.Username)
	if limits.Username == "" {
		return errors.New("username is required")
	}

	_, err := s.db.Exec(`INSERT INTO user_limits (username, max_tasks, max_containers, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(username) DO UPDATE SET
			max_tasks = excluded.max_tasks,
			max_containers = excluded.max_containers,
			updated_at = CURRENT_TIMESTAMP`,
		limits.Username, limits.MaxTasks, limits.MaxContainers,
	)
	return err
}

func (s *UserLimitsService) CheckTaskLimit(username string, currentCount int) error {
	if username == "root" || username == "system" {
		return nil
	}
	limits, err := s.Get(username)
	if err != nil {
		return nil // do not block if lookup fails unexpectedly
	}
	if limits.MaxTasks > 0 && currentCount >= limits.MaxTasks {
		return fmt.Errorf("task limit reached: user '%s' can have at most %d tasks (currently %d)", username, limits.MaxTasks, currentCount)
	}
	return nil
}

func (s *UserLimitsService) CheckContainerLimit(username string, currentCount int) error {
	if username == "root" || username == "system" {
		return nil
	}
	limits, err := s.Get(username)
	if err != nil {
		return nil // do not block if lookup fails unexpectedly
	}
	if limits.MaxContainers > 0 && currentCount >= limits.MaxContainers {
		return fmt.Errorf("container limit reached: user '%s' can have at most %d containers (currently %d)", username, limits.MaxContainers, currentCount)
	}
	return nil
}
