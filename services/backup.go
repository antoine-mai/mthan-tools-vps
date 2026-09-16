package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type BackupItem struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
	Owner   string    `json:"owner"`
}

type BackupService struct{}

func NewBackupService() *BackupService {
	return &BackupService{}
}

func (s *BackupService) ListBackups(owner string) ([]BackupItem, error) {
	var results []BackupItem

	if owner != "" {
		u, found, err := HomeUser(owner)
		if err != nil || !found {
			return nil, fmt.Errorf("user not found: %s", owner)
		}
		backupDir := filepath.Join(u.Home, "backup")
		items, _ := s.listInDir(backupDir, owner)
		results = append(results, items...)
	} else {
		users, err := HomeUsers()
		if err == nil {
			for _, u := range users {
				if u.UID == 0 {
					continue
				}
				backupDir := filepath.Join(u.Home, "backup")
				items, _ := s.listInDir(backupDir, u.Username)
				results = append(results, items...)
			}
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].ModTime.After(results[j].ModTime)
	})

	return results, nil
}

func (s *BackupService) listInDir(dir, owner string) ([]BackupItem, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var list []BackupItem
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".tar.gz") || strings.HasSuffix(name, ".tgz") || strings.HasSuffix(name, ".zip") {
			list = append(list, BackupItem{
				Name:    name,
				Path:    filepath.Join(dir, name),
				Size:    info.Size(),
				ModTime: info.ModTime(),
				Owner:   owner,
			})
		}
	}
	return list, nil
}

func (s *BackupService) CreateBackup(owner string) (*BackupItem, error) {
	u, found, err := HomeUser(owner)
	if err != nil || !found {
		return nil, fmt.Errorf("user not found: %s", owner)
	}

	backupDir := filepath.Join(u.Home, "backup")
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return nil, err
	}

	timestamp := time.Now().Format("20060102-150405")
	filename := fmt.Sprintf("backup-%s-%s.tar.gz", owner, timestamp)
	archivePath := filepath.Join(backupDir, filename)

	var targets []string
	for _, folder := range []string{"htdocs", "data", "config"} {
		folderPath := filepath.Join(u.Home, folder)
		if _, err := os.Stat(folderPath); err == nil {
			targets = append(targets, folder)
		}
	}

	if len(targets) == 0 {
		return nil, fmt.Errorf("no user directories (htdocs, data, config) found to backup in %s", u.Home)
	}

	args := append([]string{"-czf", archivePath, "-C", u.Home}, targets...)
	cmd := exec.Command("tar", args...)
	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("backup creation failed: %s", string(output))
	}

	_ = os.Chown(archivePath, u.UID, u.UID)

	info, err := os.Stat(archivePath)
	if err != nil {
		return nil, err
	}

	return &BackupItem{
		Name:    filename,
		Path:    archivePath,
		Size:    info.Size(),
		ModTime: info.ModTime(),
		Owner:   owner,
	}, nil
}

func (s *BackupService) DeleteBackup(owner, filename string) error {
	u, found, err := HomeUser(owner)
	if err != nil || !found {
		return fmt.Errorf("user not found: %s", owner)
	}

	cleanName := filepath.Base(filename)
	archivePath := filepath.Join(u.Home, "backup", cleanName)

	if !strings.HasPrefix(archivePath, filepath.Join(u.Home, "backup")) {
		return fmt.Errorf("invalid path")
	}

	return os.Remove(archivePath)
}

func (s *BackupService) RestoreBackup(owner, filename string) error {
	u, found, err := HomeUser(owner)
	if err != nil || !found {
		return fmt.Errorf("user not found: %s", owner)
	}

	cleanName := filepath.Base(filename)
	archivePath := filepath.Join(u.Home, "backup", cleanName)

	if _, err := os.Stat(archivePath); err != nil {
		return fmt.Errorf("backup file not found: %s", cleanName)
	}

	cmd := exec.Command("tar", "-xzf", archivePath, "-C", u.Home)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("restore failed: %s", string(output))
	}

	_ = exec.Command("chown", "-R", fmt.Sprintf("%d:%d", u.UID, u.UID), u.Home).Run()

	return nil
}
