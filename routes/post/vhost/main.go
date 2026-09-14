package vhost

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"mthan/vps/services"
)

func Handler(sessions *services.SessionService, vhosts *services.VHostService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := sessions.GetRootSession(r); !ok {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/post/vhost")
		switch path {
		case "", "/":
			writeJSON(w, vhosts.Status())
		case "/list":
			owner := r.URL.Query().Get("owner")
			if owner != "" {
				writeJSON(w, map[string]any{"vhosts": vhosts.SummariesForOwner(owner)})
			} else {
				writeJSON(w, map[string]any{"vhosts": vhosts.Summaries()})
			}
		case "/config":
			owner := r.URL.Query().Get("owner")
			configPath := "/etc/caddy/Caddyfile"
			if owner != "" && owner != "system" {
				_ = services.CreateUserCaddyfile(owner)
				configPath = services.UserCaddyfilePath(owner)
			}
			configs := services.NewAppConfigService()
			if r.Method == http.MethodGet {
				file, err := configs.Read("caddy", configPath)
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
				writeJSON(w, file)
				return
			}
			var input struct {
				Content string `json:"content"`
			}
			if json.NewDecoder(r.Body).Decode(&input) != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}
			file, err := configs.Write("caddy", configPath, input.Content)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			_ = vhosts.Reload()
			writeJSON(w, file)
			return
		case "/reload":
			if r.Method != http.MethodPost {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			if err := vhosts.Reload(); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		default:
			hostname := strings.TrimPrefix(path, "/")
			if hostname == "" || strings.Contains(hostname, "/") {
				http.Error(w, "vhost not found", http.StatusNotFound)
				return
			}
			if r.Method == http.MethodDelete {
				err := vhosts.Delete(hostname)
				if errors.Is(err, services.ErrVHostNotFound) {
					http.Error(w, "vhost not found", http.StatusNotFound)
					return
				}
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
				w.WriteHeader(http.StatusNoContent)
				return
			}
			host, err := vhosts.Get(hostname)
			if errors.Is(err, services.ErrVHostNotFound) {
				http.Error(w, "vhost not found", http.StatusNotFound)
				return
			}
			if err != nil {
				http.Error(w, "vhost information unavailable", http.StatusInternalServerError)
				return
			}
			writeJSON(w, host)
		}
	})
}

func writeJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(payload)
}
