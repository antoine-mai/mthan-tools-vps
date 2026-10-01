package backup

import (
	"encoding/json"
	"net/http"
	"strings"

	"mthan/vps/services"
)

func StorageHandler(sessions *services.SessionService, storageSvc *services.BackupStorageService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := sessions.GetUserSession(r)
		if !ok || session.Username == "" {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}

		user := session.Username

		switch r.Method {
		case http.MethodGet:
			storages, err := storageSvc.List(user)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"storages": storages})

		case http.MethodPost:
			var item services.BackupStorage
			if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}
			item.Owner = user
			if err := storageSvc.Save(&item); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "storage": item})

		case http.MethodDelete:
			id := strings.TrimSpace(r.URL.Query().Get("id"))
			if id == "" {
				http.Error(w, "id is required", http.StatusBadRequest)
				return
			}
			if err := storageSvc.Delete(id, user); err != nil {
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
