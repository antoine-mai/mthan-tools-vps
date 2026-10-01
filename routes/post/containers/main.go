package containers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"mthan/vps/services"
)

func Handler(sessions *services.SessionService, containers *services.ContainerService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !validSession(r, sessions) {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		owner := strings.TrimSpace(r.URL.Query().Get("owner"))
		var list []services.Container
		if owner != "" && owner != "all" {
			list = containers.ListForOwner(owner)
		} else {
			list = containers.ListAll()
		}
		if err := json.NewEncoder(w).Encode(map[string]any{"containers": list, "apps": list}); err != nil {
			http.Error(w, "could not read containers", http.StatusInternalServerError)
		}
	})
}

func DockerfileHandler(sessions *services.SessionService, containers *services.ContainerService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !validSession(r, sessions) {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		engine, owner, id := r.URL.Query().Get("engine"), r.URL.Query().Get("owner"), r.URL.Query().Get("id")
		var result services.ContainerDockerfile
		var err error
		if r.Method == http.MethodGet {
			result, err = containers.DockerfileAll(engine, owner, id)
		} else {
			var input struct {
				Content string `json:"content"`
			}
			if json.NewDecoder(r.Body).Decode(&input) != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}
			result, err = containers.WriteDockerfileAll(engine, owner, id, input.Content)
		}
		if err != nil {
			if errors.Is(err, services.ErrContainerDockerfileMissing) {
				http.Error(w, err.Error(), http.StatusNotFound)
			} else {
				http.Error(w, err.Error(), http.StatusForbidden)
			}
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
	})
}

func ActionHandler(sessions *services.SessionService, containers *services.ContainerService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !validSession(r, sessions) {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		var input struct {
			Action string `json:"action"`
			Engine string `json:"engine"`
			ID     string `json:"id"`
			Owner  string `json:"owner"`
		}
		if json.NewDecoder(r.Body).Decode(&input) != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if err := containers.ActionAll(input.Engine, input.Owner, input.ID, input.Action); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
}

func LogsHandler(sessions *services.SessionService, containers *services.ContainerService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !validSession(r, sessions) {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		logs, err := containers.LogsAll(r.URL.Query().Get("engine"), r.URL.Query().Get("owner"), r.URL.Query().Get("id"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"logs": logs})
	})
}

func CreateHandler(sessions *services.SessionService, containers *services.ContainerService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !validSession(r, sessions) {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var input services.CreateContainerInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		id, err := containers.CreateContainer(input)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok", "id": id})
	})
}

func TemplatesHandler(sessions *services.SessionService, settings *services.SettingsService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !validSession(r, sessions) {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}

		switch r.Method {
		case http.MethodGet:
			cfg, err := services.GetContainerTemplatesSettings(settings)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(cfg)

		case http.MethodPut:
			var cfg services.ContainerTemplatesSettings
			if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}
			if err := services.SaveContainerTemplatesSettings(settings, cfg); err != nil {
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

func ResetTemplatesHandler(sessions *services.SessionService, settings *services.SettingsService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !validSession(r, sessions) {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := services.ResetContainerTemplates(settings); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
}

func validSession(r *http.Request, sessions *services.SessionService) bool {
	_, ok := sessions.GetRootSession(r)
	return ok
}
