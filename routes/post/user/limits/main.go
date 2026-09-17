package limits

import (
	"encoding/json"
	"net/http"
	"strings"

	"mthan/vps/services"
)

func Handler(sessions *services.SessionService, limitsSvc *services.UserLimitsService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := sessions.GetRootSession(r); !ok {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}

		switch r.Method {
		case http.MethodGet:
			userParam := strings.TrimSpace(r.URL.Query().Get("user"))
			if userParam == "" {
				http.Error(w, "user is required", http.StatusBadRequest)
				return
			}
			limits, err := limitsSvc.Get(userParam)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(limits)

		case http.MethodPost:
			var req services.UserLimits
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Username == "" {
				http.Error(w, "invalid request data", http.StatusBadRequest)
				return
			}
			if err := limitsSvc.Set(req); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"message": "User limits updated successfully"})

		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
}
