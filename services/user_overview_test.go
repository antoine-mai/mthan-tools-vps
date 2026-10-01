package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestUserHomeSize(t *testing.T) {
	tempDir := t.TempDir()
	file1 := filepath.Join(tempDir, "file1.txt")
	_ = os.WriteFile(file1, []byte("12345"), 0644)
	file2 := filepath.Join(tempDir, "file2.txt")
	_ = os.WriteFile(file2, []byte("67890"), 0644)

	size := UserHomeSize(tempDir)
	if size < 10 {
		t.Fatalf("UserHomeSize(%q) = %d, expected >= 10", tempDir, size)
	}
}

func TestGetUserOverview(t *testing.T) {
	overview := GetUserOverview("testuser")
	if overview.Username != "testuser" {
		t.Fatalf("expected username testuser, got %s", overview.Username)
	}
	if overview.Home == "" {
		t.Fatalf("expected home path, got empty")
	}
}
