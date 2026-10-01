package backup

import (
	"encoding/json"
	"net/http"
	"strings"

	"mthan/vps/services"
)

func StorageHandler(sessions *services.SessionService, storageSvc *services.BackupStorageService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := sessions.GetRootSession(r); !ok {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}

		switch r.Method {
		case http.MethodGet:
			owner := strings.TrimSpace(r.URL.Query().Get("user"))
			storages, err := storageSvc.List(owner)
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
			if strings.TrimSpace(item.Owner) == "" {
				item.Owner = "root"
			}
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
			owner := strings.TrimSpace(r.URL.Query().Get("user"))
			if err := storageSvc.Delete(id, owner); err != nil {
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
