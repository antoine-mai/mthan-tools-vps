package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestProvisionUserHomeCreatesDefaultDirectories(t *testing.T) {
	home := filepath.Join(t.TempDir(), "user-test")
	if err := ProvisionUserHome(home, os.Getuid(), os.Getgid()); err != nil {
		t.Fatalf("ProvisionUserHome() error = %v", err)
	}

	homeInfo, err := os.Stat(home)
	if err != nil {
		t.Fatalf("stat home error: %v", err)
	}
	if homeInfo.Mode().Perm() != 0711 {
		t.Fatalf("home mode = %o, want 0711", homeInfo.Mode().Perm())
	}

	for _, name := range DefaultUserDirectories {
		info, err := os.Stat(filepath.Join(home, name))
		if err != nil {
			t.Fatalf("expected %s directory: %v", name, err)
		}
		if !info.IsDir() {
			t.Fatalf("expected %s to be a directory", name)
		}
		if info.Mode().Perm() != 0755 {
			t.Fatalf("expected %s mode 0755, got %o", name, info.Mode().Perm())
		}
	}
}
