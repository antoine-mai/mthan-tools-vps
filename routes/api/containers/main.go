package containers

import (
	"encoding/json"
	"errors"
	"net/http"

	"mthan/vps/services"
)

func UserHandler(sessions *services.SessionService, containers *services.ContainerService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := requestSession(r, sessions)
		if !ok {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		list := containers.ListCurrentUser(session.Username)
		writeJSON(w, map[string]any{"containers": list, "apps": list})
	})
}

func UserDockerfileHandler(sessions *services.SessionService, containers *services.ContainerService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := requestSession(r, sessions)
		if !ok {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		id := r.URL.Query().Get("id")
		var result services.ContainerDockerfile
		var err error
		if r.Method == http.MethodGet {
			result, err = containers.DockerfileCurrentUser(session.Username, id)
		} else {
			var input struct {
				Content string `json:"content"`
			}
			if json.NewDecoder(r.Body).Decode(&input) != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}
			result, err = containers.WriteDockerfileCurrentUser(session.Username, id, input.Content)
		}
		if err != nil {
			if errors.Is(err, services.ErrContainerDockerfileMissing) {
				http.Error(w, err.Error(), http.StatusNotFound)
			} else {
				http.Error(w, err.Error(), http.StatusForbidden)
			}
			return
		}
		writeJSON(w, result)
	})
}

func UserActionHandler(sessions *services.SessionService, containers *services.ContainerService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := requestSession(r, sessions)
		if !ok {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		var input struct {
			Action string `json:"action"`
			ID     string `json:"id"`
		}
		if json.NewDecoder(r.Body).Decode(&input) != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if err := containers.ActionCurrentUser(session.Username, input.ID, input.Action); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, map[string]string{"status": "ok"})
	})
}

func UserLogsHandler(sessions *services.SessionService, containers *services.ContainerService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := requestSession(r, sessions)
		if !ok {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		logs, err := containers.LogsCurrentUser(session.Username, r.URL.Query().Get("id"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, map[string]string{"logs": logs})
	})
}

func UserCreateHandler(sessions *services.SessionService, containers *services.ContainerService, settings *services.SettingsService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := requestSession(r, sessions)
		if !ok {
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
		if input.Type == "docker" || (input.Type == "" && input.Image != "") {
			if !services.IsImageAllowed(settings, input.Image) {
				http.Error(w, "custom container images are restricted by administrator. Please select from supported templates", http.StatusForbidden)
				return
			}
		}
		input.Owner = session.Username
		id, err := containers.CreateCurrentUser(session.Username, input)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, map[string]string{"status": "ok", "id": id})
	})
}

func UserTemplatesHandler(sessions *services.SessionService, settings *services.SettingsService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, ok := requestSession(r, sessions)
		if !ok {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		cfg, err := services.GetContainerTemplatesSettings(settings)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		var enabled []services.LibraryTemplate
		for _, t := range cfg.Templates {
			if t.Enabled {
				enabled = append(enabled, t)
			}
		}
		writeJSON(w, services.ContainerTemplatesSettings{
			Templates:   enabled,
			LibraryOnly: cfg.LibraryOnly,
		})
	})
}

func requestSession(r *http.Request, sessions *services.SessionService) (services.Session, bool) {
	return sessions.GetUserSession(r)
}

func writeJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(payload)
}
