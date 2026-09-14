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
		session, ok := sessions.GetUserSession(r)
		if !ok {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/api/vhost")
		switch path {
		case "", "/":
			writeJSON(w, http.StatusOK, vhosts.Status())
		case "/list":
			writeJSON(w, http.StatusOK, map[string]any{"vhosts": vhosts.SummariesForOwner(session.Username)})
		case "/config":
			_ = services.CreateUserCaddyfile(session.Username)
			configPath := services.UserCaddyfilePath(session.Username)
			configs := services.NewAppConfigService()
			if r.Method == http.MethodGet {
				file, err := configs.Read("caddy", configPath)
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
				writeJSON(w, http.StatusOK, file)
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
			writeJSON(w, http.StatusOK, file)
			return
		default:
			hostname := strings.TrimPrefix(path, "/")
			if hostname == "" || strings.Contains(hostname, "/") {
				http.Error(w, "vhost not found", http.StatusNotFound)
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
			writeJSON(w, http.StatusOK, host)
		}
	})
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}
