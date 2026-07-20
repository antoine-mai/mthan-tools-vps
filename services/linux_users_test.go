package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestUserAccessFromShadow(t *testing.T) {
	directory := t.TempDir()
	shadow := filepath.Join(directory, "shadow")
	content := "alice:$6$hash:1:2:3\nbob:!:1:2:3\ncarol:!$6$locked:1:2:3\ndave:*:1:2:3\n"
	if err := os.WriteFile(shadow, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	users := []LinuxUser{{Username: "alice"}, {Username: "bob"}, {Username: "carol"}, {Username: "dave"}}
	result, err := userAccessFromShadow(users, shadow)
	if err != nil {
		t.Fatal(err)
	}
	if !result[0].HasPassword || !result[0].CPanelEnabled {
		t.Fatalf("alice access = %#v", result[0])
	}
	if result[1].HasPassword || result[1].CPanelEnabled {
		t.Fatalf("bob access = %#v", result[1])
	}
	if !result[2].HasPassword || result[2].CPanelEnabled {
		t.Fatalf("carol access = %#v", result[2])
	}
	if result[3].HasPassword || result[3].CPanelEnabled {
		t.Fatalf("dave access = %#v", result[3])
	}
}

func TestHomeUsersIncludesEveryDirectory(t *testing.T) {
	home := t.TempDir()
	for _, name := range []string{"alice", "deploy", "user-generated"} {
		if err := os.Mkdir(filepath.Join(home, name), 0755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(home, "README"), []byte("not a user"), 0644); err != nil {
		t.Fatal(err)
	}

	users, err := homeUsersIn(home, map[string]passwdUser{
		"alice": {Username: "alice", UID: 1001, Shell: "/bin/bash"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(users) != 3 {
		t.Fatalf("got %d users, want 3", len(users))
	}
	if users[0].Username != "alice" || users[0].UID != 1001 || users[0].Shell != "/bin/bash" {
		t.Fatalf("alice metadata = %+v", users[0])
	}
	if users[1].Username != "deploy" || users[1].UID != -1 {
		t.Fatalf("folder-only user metadata = %+v", users[1])
	}
}

func TestUserAppsReturnsOnlyDirectChildDirectories(t *testing.T) {
	home := t.TempDir()
	htdocs := filepath.Join(home, "htdocs")
	if err := os.MkdirAll(filepath.Join(htdocs, "alpha", "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(htdocs, "beta"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(htdocs, "index.html"), []byte("test"), 0644); err != nil {
		t.Fatal(err)
	}

	apps, err := UserApps(home)
	if err != nil {
		t.Fatalf("UserApps() error = %v", err)
	}
	if len(apps) != 2 || apps[0] != "alpha" || apps[1] != "beta" {
		t.Fatalf("UserApps() = %v, want [alpha beta]", apps)
	}
}
