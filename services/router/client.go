package router

import (
	"bytes"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"mthan/vps/services"
)

type ClientRuntime struct {
	Env      string `json:"env"`
	IsRoot   bool   `json:"isRoot"`
	Mode     string `json:"mode"`
	UID      int    `json:"uid"`
	Username string `json:"username"`
}

func Register(mux *http.ServeMux, startup services.StartupConfig) {
	runtime := newClientRuntime(startup)
	if startup.IsRoot {
		registerRootRoutes(mux, runtime)
		return
	}

	registerUserRoutes(mux, runtime)
}

func PostBaseURL(startup services.StartupConfig) string {
	if startup.PostBaseURL != "" {
		return strings.TrimRight(startup.PostBaseURL, "/")
	}

	return internalBaseURL(startup.Addr)
}

func newClientRuntime(startup services.StartupConfig) ClientRuntime {
	return ClientRuntime{
		Env:      startup.Env,
		IsRoot:   startup.IsRoot,
		Mode:     startup.Mode,
		UID:      startup.UID,
		Username: startup.Username,
	}
}

func clientHandler(runtime ClientRuntime, clientDirs ...string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for _, clientDir := range clientDirs {
			fileServer := http.FileServer(http.Dir(clientDir))
			requestedPath, ok := clientPath(clientDir, r.URL.Path)
			if ok && fileExists(requestedPath) {
				if isIndexFile(requestedPath) {
					serveClientIndex(w, requestedPath, runtime)
					return
				}

				fileServer.ServeHTTP(w, r)
				return
			}
		}

		for _, clientDir := range clientDirs {
			indexPath := filepath.Join(clientDir, "index.html")
			if fileExists(indexPath) {
				serveClientIndex(w, indexPath, runtime)
				return
			}
		}

		http.Error(w, "react client has not been built", http.StatusServiceUnavailable)
	})
}

func serveClientIndex(w http.ResponseWriter, indexPath string, runtime ClientRuntime) {
	indexHTML, err := os.ReadFile(indexPath)
	if err != nil {
		http.Error(w, "react client index could not be loaded", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(injectClientRuntime(indexHTML, runtime))
}

func injectClientRuntime(indexHTML []byte, runtime ClientRuntime) []byte {
	payload, err := json.Marshal(runtime)
	if err != nil {
		payload = []byte("{}")
	}

	script := []byte("\n<script>window.__VPS_RUNTIME__ = " + string(payload) + ";</script>\n")
	headEnd := []byte("</head>")
	if bytes.Contains(indexHTML, headEnd) {
		return bytes.Replace(indexHTML, headEnd, append(script, headEnd...), 1)
	}

	return append(script, indexHTML...)
}

func clientPath(clientDir string, urlPath string) (string, bool) {
	cleanPath := path.Clean("/" + urlPath)
	requestedPath := filepath.Join(clientDir, strings.TrimPrefix(cleanPath, "/"))

	clientRoot, err := filepath.Abs(clientDir)
	if err != nil {
		return "", false
	}

	requestedAbs, err := filepath.Abs(requestedPath)
	if err != nil {
		return "", false
	}

	relativePath, err := filepath.Rel(clientRoot, requestedAbs)
	if err != nil {
		return "", false
	}

	if relativePath == ".." || strings.HasPrefix(relativePath, ".."+string(os.PathSeparator)) {
		return "", false
	}

	return requestedAbs, true
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}

	return !info.IsDir() || isIndexFile(path)
}

func isIndexFile(path string) bool {
	return filepath.Base(path) == "index.html"
}

func internalBaseURL(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err == nil {
		switch host {
		case "", "0.0.0.0", "::":
			host = "127.0.0.1"
		}

		return "http://" + net.JoinHostPort(host, port)
	}

	if strings.HasPrefix(addr, ":") {
		return "http://127.0.0.1" + addr
	}

	return "http://" + addr
}
