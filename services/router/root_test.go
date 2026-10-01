package router

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"mthan/vps/services"
)

func TestDynamicRootRoute(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "db.sqlite")
	t.Setenv("SETTINGS_DB_PATH", dbPath)

	settings, err := services.NewSettingsService()
	if err != nil {
		t.Fatal(err)
	}
	defer settings.DB().Close()

	sessions := services.NewSessionService()
	mux := http.NewServeMux()
	runtime := ClientRuntime{
		IsRoot: true,
		Mode:   "root",
	}

	mockFS := fstest.MapFS{
		"index.html": &fstest.MapFile{
			Data: []byte("<!DOCTYPE html><html><head></head><body>Root SPA</body></html>"),
		},
	}

	registerRootRoutes(mux, runtime, sessions, settings, mockFS)

	// 1. Test default /root prefix
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/root", nil)
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /root returned status %d, expected 200", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, `"basePath":"/root"`) {
		t.Fatalf("expected /root in injected runtime, got: %s", body)
	}

	// 2. Change root route to /admin-portal
	if err := settings.Set("general_root_route", "/admin-portal"); err != nil {
		t.Fatal(err)
	}

	// 3. Test old /root prefix now serves user app (basePath="")
	recOld := httptest.NewRecorder()
	reqOld := httptest.NewRequest("GET", "/root", nil)
	mux.ServeHTTP(recOld, reqOld)
	if recOld.Code != http.StatusOK {
		t.Fatalf("GET /root returned status %d", recOld.Code)
	}
	if strings.Contains(recOld.Body.String(), `"basePath":"/admin-portal"`) {
		t.Fatalf("GET /root should not serve admin portal after relocation")
	}

	// 4. Test new /admin-portal prefix
	recNew := httptest.NewRecorder()
	reqNew := httptest.NewRequest("GET", "/admin-portal", nil)
	mux.ServeHTTP(recNew, reqNew)
	if recNew.Code != http.StatusOK {
		t.Fatalf("GET /admin-portal returned status %d, expected 200", recNew.Code)
	}
	if !strings.Contains(recNew.Body.String(), `"basePath":"/admin-portal"`) {
		t.Fatalf("expected /admin-portal in injected runtime, got: %s", recNew.Body.String())
	}
}
