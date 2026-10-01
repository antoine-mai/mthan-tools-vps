package overview

import (
	"encoding/json"
	"net/http"
	"strings"

	"mthan/vps/services"
)

func Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		username := strings.TrimSpace(r.URL.Query().Get("user"))
		if username == "" {
			http.Error(w, "user parameter is required", http.StatusBadRequest)
			return
		}

		overview := services.GetUserOverview(username)
		writeJSON(w, http.StatusOK, map[string]any{
			"status":   "ok",
			"overview": overview,
		})
	})
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
	}
}
