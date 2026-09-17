package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

type CronTask struct {
	ID         string     `json:"id"`
	Owner      string     `json:"owner"`
	Name       string     `json:"name"`
	Schedule   string     `json:"schedule"`
	Command    string     `json:"command"`
	Enabled    bool       `json:"enabled"`
	LastRunAt  *time.Time `json:"lastRunAt,omitempty"`
	LastStatus string     `json:"lastStatus,omitempty"`
	LastOutput string     `json:"lastOutput,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

const (
	cronBlockBegin = "# BEGIN MTHAN VPS MANAGED TASKS"
	cronBlockEnd   = "# END MTHAN VPS MANAGED TASKS"
)

var validCronField = regexp.MustCompile(`^[0-9a-zA-Z*,\-/]+$`)

func ValidateCronSchedule(schedule string) error {
	fields := strings.Fields(strings.TrimSpace(schedule))
	if len(fields) != 5 {
		return errors.New("schedule must contain exactly 5 fields (minute hour day month weekday)")
	}
	for _, f := range fields {
		if !validCronField.MatchString(f) {
			return fmt.Errorf("invalid characters in schedule field: %s", f)
		}
	}
	return nil
}

type cronCommandRunner interface {
	Run(ctx context.Context, stdin string, name string, args ...string) ([]byte, error)
}

type execCronRunner struct{}

func (r *execCronRunner) Run(ctx context.Context, stdin string, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}
	return cmd.CombinedOutput()
}

type CronTaskService struct {
	db     *sql.DB
	limits *UserLimitsService
	runner cronCommandRunner
}

func NewCronTaskService(db *sql.DB, limits *UserLimitsService) (*CronTaskService, error) {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS cron_tasks (
		id TEXT PRIMARY KEY,
		owner TEXT NOT NULL,
		name TEXT NOT NULL,
		schedule TEXT NOT NULL,
		command TEXT NOT NULL,
		enabled INTEGER NOT NULL DEFAULT 1,
		last_run_at DATETIME,
		last_status TEXT NOT NULL DEFAULT '',
		last_output TEXT NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		return nil, err
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_cron_tasks_owner ON cron_tasks(owner)`); err != nil {
		return nil, err
	}

	return &CronTaskService{
		db:     db,
		limits: limits,
		runner: &execCronRunner{},
	}, nil
}

func (s *CronTaskService) SetRunner(runner cronCommandRunner) {
	s.runner = runner
}

func (s *CronTaskService) List(owner string) ([]CronTask, error) {
	var rows *sql.Rows
	var err error
	if owner == "" {
		rows, err = s.db.Query(`SELECT id, owner, name, schedule, command, enabled, last_run_at, last_status, last_output, created_at, updated_at FROM cron_tasks ORDER BY created_at DESC`)
	} else {
		rows, err = s.db.Query(`SELECT id, owner, name, schedule, command, enabled, last_run_at, last_status, last_output, created_at, updated_at FROM cron_tasks WHERE owner = ? ORDER BY created_at DESC`, owner)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]CronTask, 0)
	for rows.Next() {
		var t CronTask
		var enabledInt int
		var lastRunNull sql.NullTime
		var lastStatusNull, lastOutputNull sql.NullString
		if err := rows.Scan(&t.ID, &t.Owner, &t.Name, &t.Schedule, &t.Command, &enabledInt, &lastRunNull, &lastStatusNull, &lastOutputNull, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		t.Enabled = enabledInt == 1
		if lastRunNull.Valid {
			t.LastRunAt = &lastRunNull.Time
		}
		if lastStatusNull.Valid {
			t.LastStatus = lastStatusNull.String
		}
		if lastOutputNull.Valid {
			t.LastOutput = lastOutputNull.String
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func (s *CronTaskService) Get(id string) (CronTask, error) {
	var t CronTask
	var enabledInt int
	var lastRunNull sql.NullTime
	var lastStatusNull, lastOutputNull sql.NullString
	err := s.db.QueryRow(`SELECT id, owner, name, schedule, command, enabled, last_run_at, last_status, last_output, created_at, updated_at FROM cron_tasks WHERE id = ?`, id).
		Scan(&t.ID, &t.Owner, &t.Name, &t.Schedule, &t.Command, &enabledInt, &lastRunNull, &lastStatusNull, &lastOutputNull, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return CronTask{}, err
	}
	t.Enabled = enabledInt == 1
	if lastRunNull.Valid {
		t.LastRunAt = &lastRunNull.Time
	}
	if lastStatusNull.Valid {
		t.LastStatus = lastStatusNull.String
	}
	if lastOutputNull.Valid {
		t.LastOutput = lastOutputNull.String
	}
	return t, nil
}

func (s *CronTaskService) Create(task CronTask) (CronTask, error) {
	task.Name = strings.TrimSpace(task.Name)
	if task.Name == "" {
		return CronTask{}, errors.New("task name is required")
	}
	task.Command = strings.TrimSpace(task.Command)
	if task.Command == "" {
		return CronTask{}, errors.New("command is required")
	}
	task.Schedule = strings.TrimSpace(task.Schedule)
	if err := ValidateCronSchedule(task.Schedule); err != nil {
		return CronTask{}, err
	}
	task.Owner = strings.TrimSpace(task.Owner)
	if task.Owner == "" {
		task.Owner = "root"
	}

	// Check user task limit
	if s.limits != nil && task.Owner != "root" && task.Owner != "system" {
		var count int
		_ = s.db.QueryRow(`SELECT COUNT(*) FROM cron_tasks WHERE owner = ?`, task.Owner).Scan(&count)
		if err := s.limits.CheckTaskLimit(task.Owner, count); err != nil {
			return CronTask{}, err
		}
	}

	if task.ID == "" {
		b := make([]byte, 8)
		_, _ = rand.Read(b)
		task.ID = hex.EncodeToString(b)
	}

	enabledInt := 1
	if !task.Enabled {
		enabledInt = 0
	}

	now := time.Now()
	task.CreatedAt = now
	task.UpdatedAt = now

	_, err := s.db.Exec(`INSERT INTO cron_tasks (id, owner, name, schedule, command, enabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		task.ID, task.Owner, task.Name, task.Schedule, task.Command, enabledInt, now, now,
	)
	if err != nil {
		return CronTask{}, err
	}

	_ = s.SyncCrontab(task.Owner)
	return task, nil
}

func (s *CronTaskService) Update(task CronTask) error {
	task.Name = strings.TrimSpace(task.Name)
	if task.Name == "" {
		return errors.New("task name is required")
	}
	task.Command = strings.TrimSpace(task.Command)
	if task.Command == "" {
		return errors.New("command is required")
	}
	task.Schedule = strings.TrimSpace(task.Schedule)
	if err := ValidateCronSchedule(task.Schedule); err != nil {
		return err
	}

	enabledInt := 0
	if task.Enabled {
		enabledInt = 1
	}

	res, err := s.db.Exec(`UPDATE cron_tasks SET name = ?, schedule = ?, command = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		task.Name, task.Schedule, task.Command, enabledInt, task.ID,
	)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("task not found")
	}

	_ = s.SyncCrontab(task.Owner)
	return nil
}

func (s *CronTaskService) Toggle(id string, enabled bool) error {
	existing, err := s.Get(id)
	if err != nil {
		return err
	}

	enabledInt := 0
	if enabled {
		enabledInt = 1
	}

	_, err = s.db.Exec(`UPDATE cron_tasks SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, enabledInt, id)
	if err != nil {
		return err
	}

	_ = s.SyncCrontab(existing.Owner)
	return nil
}

func (s *CronTaskService) Delete(id string) error {
	existing, err := s.Get(id)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`DELETE FROM cron_tasks WHERE id = ?`, id)
	if err != nil {
		return err
	}

	_ = s.SyncCrontab(existing.Owner)
	return nil
}

func (s *CronTaskService) RunNow(id string) (string, error) {
	task, err := s.Get(id)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
	defer cancel()

	var output []byte
	var execErr error

	if task.Owner == "root" || task.Owner == "system" {
		output, execErr = s.runner.Run(ctx, "", "bash", "-c", task.Command)
	} else {
		output, execErr = s.runner.Run(ctx, "", "runuser", "-u", task.Owner, "--", "bash", "-c", task.Command)
	}

	status := "success"
	if execErr != nil {
		status = "failed"
	}

	outStr := strings.TrimSpace(string(output))
	if len(outStr) > 4096 {
		outStr = outStr[:4096] + "\n... [output truncated]"
	}

	_, _ = s.db.Exec(`UPDATE cron_tasks SET last_run_at = CURRENT_TIMESTAMP, last_status = ?, last_output = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		status, outStr, id,
	)

	if execErr != nil {
		if outStr != "" {
			return outStr, fmt.Errorf("command execution failed: %s", outStr)
		}
		return "", execErr
	}
	return outStr, nil
}

func (s *CronTaskService) SyncCrontab(owner string) error {
	owner = strings.TrimSpace(owner)
	if owner == "" {
		owner = "root"
	}

	// 1. Fetch all enabled tasks for this owner
	tasks, err := s.List(owner)
	if err != nil {
		return err
	}

	var mthanLines []string
	for _, t := range tasks {
		if t.Enabled {
			mthanLines = append(mthanLines, fmt.Sprintf("# mthan-task: %s | %s", t.ID, t.Name))
			mthanLines = append(mthanLines, fmt.Sprintf("%s %s", t.Schedule, t.Command))
		}
	}

	// 2. Read existing crontab
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existingRaw []byte
	if owner == "root" {
		existingRaw, _ = s.runner.Run(ctx, "", "crontab", "-l")
	} else {
		existingRaw, _ = s.runner.Run(ctx, "", "crontab", "-u", owner, "-l")
	}

	lines := strings.Split(string(existingRaw), "\n")
	var preserved []string
	insideMthanBlock := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == cronBlockBegin {
			insideMthanBlock = true
			continue
		}
		if trimmed == cronBlockEnd {
			insideMthanBlock = false
			continue
		}
		if !insideMthanBlock && trimmed != "" && !strings.Contains(trimmed, "no crontab for") {
			preserved = append(preserved, line)
		}
	}

	var finalBuffer bytes.Buffer
	for _, l := range preserved {
		finalBuffer.WriteString(l)
		finalBuffer.WriteString("\n")
	}

	if len(mthanLines) > 0 {
		finalBuffer.WriteString(cronBlockBegin)
		finalBuffer.WriteString("\n")
		for _, ml := range mthanLines {
			finalBuffer.WriteString(ml)
			finalBuffer.WriteString("\n")
		}
		finalBuffer.WriteString(cronBlockEnd)
		finalBuffer.WriteString("\n")
	}

	finalContent := finalBuffer.String()

	// 3. Write back to crontab
	ctxWrite, cancelWrite := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelWrite()

	if strings.TrimSpace(finalContent) == "" {
		if owner == "root" {
			_, _ = s.runner.Run(ctxWrite, "", "crontab", "-r")
		} else {
			_, _ = s.runner.Run(ctxWrite, "", "crontab", "-u", owner, "-r")
		}
		return nil
	}

	if owner == "root" {
		_, err = s.runner.Run(ctxWrite, finalContent, "crontab", "-")
	} else {
		_, err = s.runner.Run(ctxWrite, finalContent, "crontab", "-u", owner, "-")
	}
	return err
}
