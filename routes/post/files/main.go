package files

import (
	"encoding/json"
	"errors"
	"net/http"

	"mthan/vps/services"
)

func Handler(sessions *services.SessionService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(services.SessionCookieName)
		if err != nil {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}

		_, ok := sessions.Get(cookie.Value)
		if !ok {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}

		requestedPath := r.URL.Query().Get("path")
		isContent := r.URL.Query().Get("content") == "true"

		// Root mode exposes the full filesystem and starts the explorer at /.
		homeDir := "/"
		if r.Method != http.MethodGet {
			handleMutation(w, r, homeDir, true)
			return
		}

		if isContent {
			content, err := services.GetFileContent(requestedPath, homeDir, true)
			if err != nil {
				if errors.Is(err, services.ErrAccessDenied) {
					http.Error(w, "access denied", http.StatusForbidden)
				} else {
					http.Error(w, err.Error(), http.StatusInternalServerError)
				}
				return
			}
			writeJSON(w, http.StatusOK, content)
			return
		}

		list, err := services.ListDirectory(requestedPath, homeDir, true)
		if err != nil {
			if errors.Is(err, services.ErrAccessDenied) {
				http.Error(w, "access denied", http.StatusForbidden)
			} else {
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
			return
		}

		writeJSON(w, http.StatusOK, list)
	})
}

func handleMutation(w http.ResponseWriter, r *http.Request, homeDir string, isRoot bool) {
	var input struct {
		Path string `json:"path"`
		Name string `json:"name"`
		Kind string `json:"kind"`
	}
	if json.NewDecoder(r.Body).Decode(&input) != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	var resultPath string
	var err error
	switch r.Method {
	case http.MethodPost:
		err = services.CreateFileItem(input.Path, input.Name, homeDir, isRoot, input.Kind == "folder")
	case http.MethodPatch:
		resultPath, err = services.RenameFileItem(input.Path, input.Name, homeDir, isRoot)
	case http.MethodDelete:
		err = services.DeleteFileItem(input.Path, homeDir, isRoot)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, services.ErrAccessDenied) {
			status = http.StatusForbidden
		}
		if errors.Is(err, services.ErrInvalidFileOperation) {
			status = http.StatusBadRequest
		}
		http.Error(w, err.Error(), status)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"path": resultPath})
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
	}
}
