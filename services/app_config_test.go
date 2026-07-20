package services

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestAppConfigReadWriteUsesAllowlist(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "daemon.json")
	service := &AppConfigService{allowed: map[string]map[string]bool{"docker": {path: true}}}

	initial, err := service.Read("docker", path)
	if err != nil || initial.Exists || initial.Content != "{}\n" {
		t.Fatalf("initial config = %#v, %v", initial, err)
	}
	if _, err := service.Write("docker", path, "{\"debug\":true}\n"); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil || string(data) != "{\"debug\":true}\n" {
		t.Fatalf("saved data = %q, %v", data, err)
	}
	if _, err := service.Read("podman", path); !errors.Is(err, ErrAppConfigDenied) {
		t.Fatalf("disallowed read error = %v", err)
	}
}

func TestAppConfigRejectsInvalidJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "daemon.json")
	service := &AppConfigService{allowed: map[string]map[string]bool{"docker": {path: true}}}
	if _, err := service.Write("docker", path, "not json"); !errors.Is(err, ErrAppConfigInvalid) {
		t.Fatalf("invalid JSON error = %v", err)
	}
}
