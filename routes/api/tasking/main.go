package tasking

import (
	"encoding/json"
	"net/http"

	"mthan/vps/services"
)

func Handler(sessions *services.SessionService, cronSvc *services.CronTaskService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := sessions.GetUserSession(r)
		if !ok || session.Username == "" {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}

		switch r.Method {
		case http.MethodGet:
			tasks, err := cronSvc.List(session.Username)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"tasks": tasks})

		case http.MethodPost:
			var req services.CronTask
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}
			// Force owner to current session user
			req.Owner = session.Username
			task, err := cronSvc.Create(req)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(task)

		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
}

func UpdateHandler(sessions *services.SessionService, cronSvc *services.CronTaskService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := sessions.GetUserSession(r)
		if !ok || session.Username == "" {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req services.CronTask
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
			http.Error(w, "invalid task data", http.StatusBadRequest)
			return
		}

		// Ensure task belongs to current user
		existing, err := cronSvc.Get(req.ID)
		if err != nil {
			http.Error(w, "task not found", http.StatusNotFound)
			return
		}
		if existing.Owner != session.Username {
			http.Error(w, "access denied", http.StatusForbidden)
			return
		}

		req.Owner = session.Username
		if err := cronSvc.Update(req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"message": "Task updated successfully"})
	})
}

func ToggleHandler(sessions *services.SessionService, cronSvc *services.CronTaskService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := sessions.GetUserSession(r)
		if !ok || session.Username == "" {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			ID      string `json:"id"`
			Enabled bool   `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		existing, err := cronSvc.Get(req.ID)
		if err != nil {
			http.Error(w, "task not found", http.StatusNotFound)
			return
		}
		if existing.Owner != session.Username {
			http.Error(w, "access denied", http.StatusForbidden)
			return
		}

		if err := cronSvc.Toggle(req.ID, req.Enabled); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"message": "Task status updated"})
	})
}

func DeleteHandler(sessions *services.SessionService, cronSvc *services.CronTaskService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := sessions.GetUserSession(r)
		if !ok || session.Username == "" {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
			http.Error(w, "task id is required", http.StatusBadRequest)
			return
		}

		existing, err := cronSvc.Get(req.ID)
		if err != nil {
			http.Error(w, "task not found", http.StatusNotFound)
			return
		}
		if existing.Owner != session.Username {
			http.Error(w, "access denied", http.StatusForbidden)
			return
		}

		if err := cronSvc.Delete(req.ID); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"message": "Task deleted successfully"})
	})
}

func RunHandler(sessions *services.SessionService, cronSvc *services.CronTaskService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := sessions.GetUserSession(r)
		if !ok || session.Username == "" {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
			http.Error(w, "task id is required", http.StatusBadRequest)
			return
		}

		existing, err := cronSvc.Get(req.ID)
		if err != nil {
			http.Error(w, "task not found", http.StatusNotFound)
			return
		}
		if existing.Owner != session.Username {
			http.Error(w, "access denied", http.StatusForbidden)
			return
		}

		output, err := cronSvc.RunNow(req.ID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"message": "Task executed",
			"output":  output,
		})
	})
}
