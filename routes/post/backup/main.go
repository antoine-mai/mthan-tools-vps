package backup

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"mthan/vps/services"
)

func Handler(sessions *services.SessionService, backupSvc *services.BackupService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := sessions.GetRootSession(r); !ok {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}

		switch r.Method {
		case http.MethodGet:
			userParam := strings.TrimSpace(r.URL.Query().Get("user"))
			fileParam := strings.TrimSpace(r.URL.Query().Get("file"))
			isDownload := r.URL.Query().Get("download") == "true"

			if isDownload && userParam != "" && fileParam != "" {
				u, found, err := services.HomeUser(userParam)
				if err != nil || !found {
					http.Error(w, "user not found", http.StatusNotFound)
					return
				}
				cleanName := filepath.Base(fileParam)
				targetPath := filepath.Join(u.Home, "backup", cleanName)
				if _, err := os.Stat(targetPath); err != nil {
					http.Error(w, "file not found", http.StatusNotFound)
					return
				}
				w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", cleanName))
				http.ServeFile(w, r, targetPath)
				return
			}

			items, err := backupSvc.ListBackups(userParam)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"backups": items})

		case http.MethodPost:
			var req struct {
				User string `json:"user"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.User == "" {
				http.Error(w, "user is required", http.StatusBadRequest)
				return
			}
			item, err := backupSvc.CreateBackup(req.User)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "backup": item})

		case http.MethodDelete:
			var req struct {
				User string `json:"user"`
				File string `json:"file"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.User == "" || req.File == "" {
				http.Error(w, "user and file are required", http.StatusBadRequest)
				return
			}
			if err := backupSvc.DeleteBackup(req.User, req.File); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})

		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
}

func RestoreHandler(sessions *services.SessionService, backupSvc *services.BackupService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := sessions.GetRootSession(r); !ok {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			User string `json:"user"`
			File string `json:"file"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.User == "" || req.File == "" {
			http.Error(w, "user and file are required", http.StatusBadRequest)
			return
		}
		if err := backupSvc.RestoreBackup(req.User, req.File); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
}
