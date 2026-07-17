package apps

import (
	"encoding/json"
	"net/http"
	"strings"

	"mthan/vps/services"
)

func Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		username := strings.TrimSpace(r.URL.Query().Get("username"))
		if username == "" {
			http.Error(w, "username is required", http.StatusBadRequest)
			return
		}

		linuxUser, exists, err := services.HomeUser(username)
		if err != nil {
			http.Error(w, "linux users could not be loaded", http.StatusInternalServerError)
			return
		}
		if !exists {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}

		userApps, err := services.UserApps(linuxUser.Home)
		if err != nil {
			http.Error(w, "user apps could not be loaded", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": "ok",
			"apps":   userApps,
		})
	})
}
