package services

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSessionPersistsToDisk(t *testing.T) {
	t.Setenv("SESSION_PATH", filepath.Join(t.TempDir(), "session"))

	first := NewSessionService()
	session, err := first.Create(AuthenticatedUser{
		UID:      0,
		Username: "root",
	}, "root")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	second := NewSessionService()
	loaded, ok := second.Get(session.Token)
	if !ok {
		t.Fatal("expected persisted session to load")
	}
	if loaded.Username != "root" || loaded.Mode != "root" {
		t.Fatalf("unexpected session: %+v", loaded)
	}
}

func TestSessionRejectsRootModeForRegularUser(t *testing.T) {
	t.Setenv("SESSION_PATH", filepath.Join(t.TempDir(), "session"))

	sessions := NewSessionService()
	if _, err := sessions.Create(AuthenticatedUser{
		UID:      1000,
		Username: "user-test",
	}, "root"); err != ErrInvalidSessionMode {
		t.Fatalf("expected invalid session mode, got %v", err)
	}
}

func TestSessionRejectsUserModeForRoot(t *testing.T) {
	t.Setenv("SESSION_PATH", filepath.Join(t.TempDir(), "session"))

	sessions := NewSessionService()
	if _, err := sessions.Create(AuthenticatedUser{
		UID:      0,
		Username: "root",
	}, "user"); err != ErrInvalidSessionMode {
		t.Fatalf("expected invalid session mode, got %v", err)
	}
}

func TestSessionInvalidatesPersistedRootModeForRegularUser(t *testing.T) {
	path := filepath.Join(t.TempDir(), "session")
	t.Setenv("SESSION_PATH", path)

	persisted := map[string]Session{
		"unsafe-token": {
			ExpiresAt: time.Now().Add(time.Hour),
			Mode:      "root",
			Token:     "unsafe-token",
			UID:       1000,
			Username:  "user-test",
		},
	}
	data, err := json.Marshal(persisted)
	if err != nil {
		t.Fatalf("marshal session: %v", err)
	}
	if err := os.WriteFile(path, data, 0600); err != nil {
		t.Fatalf("write session: %v", err)
	}

	sessions := NewSessionService()
	if _, ok := sessions.Get("unsafe-token"); ok {
		t.Fatal("expected unsafe persisted session to be invalidated")
	}
}

func TestSeparateRootAndUserSessions(t *testing.T) {
	t.Setenv("SESSION_PATH", filepath.Join(t.TempDir(), "session"))

	sessions := NewSessionService()
	rootSession, err := sessions.Create(AuthenticatedUser{
		UID:      0,
		Username: "root",
	}, "root")
	if err != nil {
		t.Fatalf("create root session: %v", err)
	}

	userSession, err := sessions.Create(AuthenticatedUser{
		UID:      1001,
		Username: "user1",
	}, "user")
	if err != nil {
		t.Fatalf("create user session: %v", err)
	}

	// Request with both cookies present simultaneously
	req, _ := http.NewRequest(http.MethodGet, "http://localhost/", nil)
	req.AddCookie(&http.Cookie{Name: RootSessionCookieName, Value: rootSession.Token})
	req.AddCookie(&http.Cookie{Name: UserSessionCookieName, Value: userSession.Token})

	gotRoot, ok := sessions.GetRootSession(req)
	if !ok || gotRoot.Username != "root" || gotRoot.Mode != "root" {
		t.Fatalf("expected valid root session, got %+v (ok=%v)", gotRoot, ok)
	}

	gotUser, ok := sessions.GetUserSession(req)
	if !ok || gotUser.Username != "user1" || gotUser.Mode != "user" {
		t.Fatalf("expected valid user session, got %+v (ok=%v)", gotUser, ok)
	}
}
