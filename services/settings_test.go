package services

import (
	"path/filepath"
	"testing"
)

func TestSettingsServiceCreatesAndUpdatesSettings(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".mthan-vps", "data", "db.sqlite")
	t.Setenv(settingsDBEnv, path)

	service, err := NewSettingsService()
	if err != nil {
		t.Fatal(err)
	}
	defer service.db.Close()

	if err := service.Set("apps_header", `["caddy"]`); err != nil {
		t.Fatal(err)
	}
	if err := service.Set("apps_header", `["caddy","podman"]`); err != nil {
		t.Fatal(err)
	}
	settings, err := service.All()
	if err != nil {
		t.Fatal(err)
	}
	if got := settings["apps_header"]; got != `["caddy","podman"]` {
		t.Fatalf("apps_header = %q", got)
	}
}

func TestSettingsDBPathUsesUserHome(t *testing.T) {
	t.Setenv(settingsDBEnv, "")
	home := t.TempDir()
	t.Setenv("HOME", home)
	want := filepath.Join(home, ".mthan-vps", "data", "db.sqlite")
	if got := settingsDBPath(); got != want {
		t.Fatalf("settingsDBPath() = %q, want %q", got, want)
	}
}

func TestSettingsServiceRootRoute(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".mthan-vps", "data", "db.sqlite")
	t.Setenv(settingsDBEnv, path)

	service, err := NewSettingsService()
	if err != nil {
		t.Fatal(err)
	}
	defer service.db.Close()

	if got := service.RootRoute(); got != "/root" {
		t.Fatalf("default RootRoute = %q, want /root", got)
	}

	if !ValidSetting("general_root_route", "/admin") {
		t.Fatal("expected /admin to be valid")
	}
	if !ValidSetting("general_root_route", "custom-panel") {
		t.Fatal("expected custom-panel to be valid")
	}
	if ValidSetting("general_root_route", "/login") {
		t.Fatal("expected /login to be rejected as reserved")
	}
	if ValidSetting("general_root_route", "/api") {
		t.Fatal("expected /api to be rejected as reserved")
	}
	if ValidSetting("general_root_route", "/apps") {
		t.Fatal("expected /apps to be rejected as reserved")
	}
	if ValidSetting("general_root_route", "a/b/c") {
		t.Fatal("expected nested path to be rejected")
	}

	if err := service.Set("general_root_route", "my-admin"); err != nil {
		t.Fatal(err)
	}
	if got := service.RootRoute(); got != "/my-admin" {
		t.Fatalf("RootRoute = %q, want /my-admin", got)
	}
}
