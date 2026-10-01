package services

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestUserLimitsService(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("failed to open sqlite memory: %v", err)
	}
	defer db.Close()

	svc, err := NewUserLimitsService(db)
	if err != nil {
		t.Fatalf("failed to create UserLimitsService: %v", err)
	}

	// 1. Default limits
	limits, err := svc.Get("alice")
	if err != nil {
		t.Fatalf("failed to get default limits: %v", err)
	}
	if limits.MaxTasks != DefaultMaxTasks || limits.MaxContainers != DefaultMaxContainers {
		t.Errorf("expected defaults (%d, %d), got (%d, %d)", DefaultMaxTasks, DefaultMaxContainers, limits.MaxTasks, limits.MaxContainers)
	}

	// 2. Set limits
	err = svc.Set(UserLimits{
		Username:      "alice",
		MaxTasks:      3,
		MaxContainers: 2,
	})
	if err != nil {
		t.Fatalf("failed to set limits: %v", err)
	}

	limits, err = svc.Get("alice")
	if err != nil {
		t.Fatalf("failed to get updated limits: %v", err)
	}
	if limits.MaxTasks != 3 || limits.MaxContainers != 2 {
		t.Errorf("expected (3, 2), got (%d, %d)", limits.MaxTasks, limits.MaxContainers)
	}

	// 3. Check Task Limit
	if err := svc.CheckTaskLimit("alice", 2); err != nil {
		t.Errorf("expected 2 tasks to be allowed, got %v", err)
	}
	if err := svc.CheckTaskLimit("alice", 3); err == nil {
		t.Errorf("expected 3 tasks to be rejected by limit")
	}

	// Root should never be limited
	if err := svc.CheckTaskLimit("root", 100); err != nil {
		t.Errorf("expected root to bypass limits, got %v", err)
	}

	// 4. Check Container Limit
	if err := svc.CheckContainerLimit("alice", 1); err != nil {
		t.Errorf("expected 1 container to be allowed, got %v", err)
	}
	if err := svc.CheckContainerLimit("alice", 2); err == nil {
		t.Errorf("expected 2 containers to be rejected by limit")
	}
	if err := svc.CheckContainerLimit("root", 100); err != nil {
		t.Errorf("expected root to bypass container limit, got %v", err)
	}
}
