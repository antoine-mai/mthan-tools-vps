package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSaveFileContent(t *testing.T) {
	tempDir := t.TempDir()
	testFile := filepath.Join(tempDir, "test.txt")

	// 1. Write to non-existent file
	err := SaveFileContent(testFile, "hello world", tempDir, false)
	if err != nil {
		t.Fatalf("SaveFileContent failed on new file: %v", err)
	}

	data, err := os.ReadFile(testFile)
	if err != nil {
		t.Fatalf("failed to read test file: %v", err)
	}
	if string(data) != "hello world" {
		t.Fatalf("file content = %q, want %q", string(data), "hello world")
	}

	// 2. Overwrite existing file
	err = SaveFileContent(testFile, "updated content\nsecond line", tempDir, false)
	if err != nil {
		t.Fatalf("SaveFileContent failed on overwrite: %v", err)
	}

	data, err = os.ReadFile(testFile)
	if err != nil {
		t.Fatalf("failed to read updated file: %v", err)
	}
	if string(data) != "updated content\nsecond line" {
		t.Fatalf("file content = %q, want %q", string(data), "updated content\nsecond line")
	}

	// 3. Deny write outside homeDir for non-root
	outsideFile := filepath.Join(os.TempDir(), "outside.txt")
	err = SaveFileContent(outsideFile, "bad", tempDir, false)
	if err == nil {
		t.Fatalf("expected error writing outside homeDir for non-root, got nil")
	}

	// 4. Deny writing to directory
	err = SaveFileContent(tempDir, "cannot write dir", tempDir, true)
	if err == nil {
		t.Fatalf("expected error writing to directory path, got nil")
	}
}
