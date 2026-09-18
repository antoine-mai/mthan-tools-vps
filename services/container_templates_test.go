package services

import (
	"os"
	"path/filepath"
	"testing"
)

func setupTestSettings(t *testing.T) *SettingsService {
	t.Helper()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_settings.db")
	t.Setenv("SETTINGS_DB_PATH", dbPath)

	settings, err := NewSettingsService()
	if err != nil {
		t.Fatalf("failed to create test settings: %v", err)
	}
	t.Cleanup(func() {
		_ = settings.DB().Close()
		_ = os.Remove(dbPath)
	})
	return settings
}

func TestDefaultContainerTemplates(t *testing.T) {
	settings := setupTestSettings(t)
	cfg, err := GetContainerTemplatesSettings(settings)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Templates) == 0 {
		t.Fatalf("expected default templates, got 0")
	}
	if cfg.LibraryOnly {
		t.Fatalf("expected libraryOnly to be false by default")
	}
}

func TestSaveAndResetContainerTemplates(t *testing.T) {
	settings := setupTestSettings(t)
	cfg, err := GetContainerTemplatesSettings(settings)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	cfg.LibraryOnly = true
	cfg.Templates = append(cfg.Templates, LibraryTemplate{
		ID:          "custom-app",
		Name:        "Custom App",
		Image:       "custom/app:1.0",
		Category:    "tools",
		Description: "Custom application",
		Enabled:     true,
		IsCustom:    true,
	})

	if err := SaveContainerTemplatesSettings(settings, cfg); err != nil {
		t.Fatalf("failed to save settings: %v", err)
	}

	loaded, err := GetContainerTemplatesSettings(settings)
	if err != nil {
		t.Fatalf("failed to load settings: %v", err)
	}
	if !loaded.LibraryOnly {
		t.Fatalf("expected libraryOnly to be true")
	}
	found := false
	for _, item := range loaded.Templates {
		if item.ID == "custom-app" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected custom-app in loaded templates")
	}

	// Test IsImageAllowed
	if !IsImageAllowed(settings, "custom/app:1.0") {
		t.Fatalf("expected custom/app:1.0 to be allowed")
	}
	if IsImageAllowed(settings, "hacker/malware:latest") {
		t.Fatalf("expected hacker/malware:latest to NOT be allowed")
	}

	// Test Reset
	if err := ResetContainerTemplates(settings); err != nil {
		t.Fatalf("failed to reset: %v", err)
	}
	resetLoaded, _ := GetContainerTemplatesSettings(settings)
	if resetLoaded.LibraryOnly {
		t.Fatalf("expected libraryOnly to be reset to false")
	}
	for _, item := range resetLoaded.Templates {
		if item.ID == "custom-app" {
			t.Fatalf("did not expect custom-app after reset")
		}
	}
}
