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
			if r.Method == http.MethodPost {
				handleCreateVHost(w, r, session.Username, vhosts)
				return
			}
			writeJSON(w, http.StatusOK, vhosts.Status())
		case "/list":
			writeJSON(w, http.StatusOK, map[string]any{"vhosts": vhosts.SummariesForOwner(session.Username)})
		case "/create":
			if r.Method != http.MethodPost {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			handleCreateVHost(w, r, session.Username, vhosts)
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
			if r.Method == http.MethodDelete {
				err := vhosts.Delete(hostname, session.Username)
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
			if !strings.EqualFold(host.Owner, session.Username) {
				http.Error(w, "vhost not found", http.StatusNotFound)
				return
			}
			writeJSON(w, http.StatusOK, host)
		}
	})
}

func handleCreateVHost(w http.ResponseWriter, r *http.Request, username string, vhosts *services.VHostService) {
	var input services.CreateVHostInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	input.Owner = username
	if err := vhosts.CreateVHost(input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"hostname": services.CleanHostname(input.Hostname),
	})
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}
