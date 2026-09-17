package services

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

type mockCronRunner struct {
	crontabData map[string]string
	executedCmd []string
}

func newMockCronRunner() *mockCronRunner {
	return &mockCronRunner{
		crontabData: make(map[string]string),
	}
}

func (m *mockCronRunner) Run(ctx context.Context, stdin string, name string, args ...string) ([]byte, error) {
	if name == "crontab" {
		// crontab -l or crontab -u user -l
		if len(args) == 1 && args[0] == "-l" {
			return []byte(m.crontabData["root"]), nil
		}
		if len(args) == 3 && args[0] == "-u" && args[2] == "-l" {
			return []byte(m.crontabData[args[1]]), nil
		}
		// crontab - or crontab -u user -
		if len(args) == 1 && args[0] == "-" {
			m.crontabData["root"] = stdin
			return nil, nil
		}
		if len(args) == 3 && args[0] == "-u" && args[2] == "-" {
			m.crontabData[args[1]] = stdin
			return nil, nil
		}
		// crontab -r or crontab -u user -r
		if len(args) == 1 && args[0] == "-r" {
			delete(m.crontabData, "root")
			return nil, nil
		}
		if len(args) == 3 && args[0] == "-u" && args[2] == "-r" {
			delete(m.crontabData, args[1])
			return nil, nil
		}
	}
	m.executedCmd = append(m.executedCmd, name+" "+strings.Join(args, " "))
	return []byte("execution success"), nil
}

func TestCronTaskService(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("failed to open sqlite memory: %v", err)
	}
	defer db.Close()

	limitsSvc, err := NewUserLimitsService(db)
	if err != nil {
		t.Fatalf("failed to init limits: %v", err)
	}

	cronSvc, err := NewCronTaskService(db, limitsSvc)
	if err != nil {
		t.Fatalf("failed to init cron tasks: %v", err)
	}

	mockRunner := newMockCronRunner()
	cronSvc.SetRunner(mockRunner)

	// 1. Validation test
	if err := ValidateCronSchedule("invalid schedule"); err == nil {
		t.Errorf("expected invalid schedule error")
	}
	if err := ValidateCronSchedule("0 0 * * *"); err != nil {
		t.Errorf("expected valid schedule, got error: %v", err)
	}

	// 2. Create task
	task, err := cronSvc.Create(CronTask{
		Owner:    "alice",
		Name:     "Backup DB",
		Schedule: "0 2 * * *",
		Command:  "/usr/bin/backup.sh",
		Enabled:  true,
	})
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}
	if task.ID == "" {
		t.Errorf("expected task ID to be generated")
	}

	// Check crontab sync
	aliceCron := mockRunner.crontabData["alice"]
	if !strings.Contains(aliceCron, "0 2 * * * /usr/bin/backup.sh") {
		t.Errorf("expected crontab to contain task command, got: %s", aliceCron)
	}

	// 3. List tasks
	list, err := cronSvc.List("alice")
	if err != nil || len(list) != 1 {
		t.Fatalf("expected 1 task, got %d (err: %v)", len(list), err)
	}

	// 4. Toggle task
	err = cronSvc.Toggle(task.ID, false)
	if err != nil {
		t.Fatalf("failed to toggle task: %v", err)
	}
	aliceCron = mockRunner.crontabData["alice"]
	if strings.Contains(aliceCron, "0 2 * * * /usr/bin/backup.sh") {
		t.Errorf("expected disabled task to be removed from crontab, got: %s", aliceCron)
	}

	// 5. Run now
	out, err := cronSvc.RunNow(task.ID)
	if err != nil {
		t.Fatalf("failed to run task: %v", err)
	}
	if out != "execution success" {
		t.Errorf("expected execution output 'execution success', got: %s", out)
	}

	// Verify last_status
	updated, _ := cronSvc.Get(task.ID)
	if updated.LastStatus != "success" {
		t.Errorf("expected last status 'success', got %s", updated.LastStatus)
	}

	// 6. Test task limit enforcement
	_ = limitsSvc.Set(UserLimits{Username: "bob", MaxTasks: 1})
	_, err = cronSvc.Create(CronTask{
		Owner:    "bob",
		Name:     "Task 1",
		Schedule: "* * * * *",
		Command:  "echo 1",
		Enabled:  true,
	})
	if err != nil {
		t.Fatalf("failed to create task 1 for bob: %v", err)
	}
	_, err = cronSvc.Create(CronTask{
		Owner:    "bob",
		Name:     "Task 2",
		Schedule: "* * * * *",
		Command:  "echo 2",
		Enabled:  true,
	})
	if err == nil {
		t.Errorf("expected task limit error for bob creating second task")
	}
}
