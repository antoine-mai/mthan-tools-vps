package services

import (
	"os"
	"path/filepath"
	"testing"
)

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
