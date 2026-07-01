package post

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/url"
	"strings"

	userlogin "mthan/vps/routes/post/user/login"
	"mthan/vps/services"
)

type Dependencies struct {
	Auth     *services.AuthService
	Sessions *services.SessionService
	Startup  services.StartupConfig
	Update   *services.UpdateService
}

func Register(mux *http.ServeMux, deps Dependencies) {
	mux.Handle("OPTIONS /post/", postOnly(deps.Startup, http.HandlerFunc(noContent)))
	registerLogin(mux, deps)
	mux.Handle("POST /post/user/login", postOnly(deps.Startup, userlogin.Handler(deps.Auth)))
	registerUpdate(mux, deps)
	mux.Handle("POST /post/ping", postOnly(deps.Startup, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok",
		})
	})))
}

type loginResponse struct {
	Session *services.Session          `json:"session,omitempty"`
	Status  string                     `json:"status"`
	User    services.AuthenticatedUser `json:"user"`
}

func authenticate(w http.ResponseWriter, r *http.Request, auth *services.AuthService) (services.AuthenticatedUser, bool) {
	var credentials services.LoginCredentials
	if err := json.NewDecoder(r.Body).Decode(&credentials); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return services.AuthenticatedUser{}, false
	}

	user, err := auth.AuthenticateLinuxUser(credentials)
	if err != nil {
		writeAuthError(w, err)
		return services.AuthenticatedUser{}, false
	}

	return user, true
}

func writeAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, services.ErrInvalidCredentials):
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
	case errors.Is(err, services.ErrAuthUnavailable):
		http.Error(w, "auth unavailable", http.StatusServiceUnavailable)
	default:
		http.Error(w, "auth failed", http.StatusInternalServerError)
	}
}

func postOnly(startup services.StartupConfig, next http.Handler) http.Handler {
	return sameDomainOrLocalhostOnly(rootOnly(startup, next))
}

func rootOnly(startup services.StartupConfig, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !startup.IsRoot {
			http.Error(w, "root process required", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func setSessionCookie(w http.ResponseWriter, r *http.Request, sessions *services.SessionService, session services.Session) {
	http.SetCookie(w, &http.Cookie{
		HttpOnly: true,
		MaxAge:   sessions.MaxAge(),
		Name:     services.SessionCookieName,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil,
		Value:    session.Token,
	})
}

func sameDomainOrLocalhostOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		source := requestSource(r)
		if !isAllowedPostSource(r, source) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}

		if source != "" {
			w.Header().Set("Access-Control-Allow-Origin", source)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Add("Vary", "Origin")
		}

		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		next.ServeHTTP(w, r)
	})
}

func requestSource(r *http.Request) string {
	if origin := r.Header.Get("Origin"); origin != "" {
		return origin
	}

	if referer := r.Header.Get("Referer"); referer != "" {
		return referer
	}

	return ""
}

func isAllowedPostSource(r *http.Request, source string) bool {
	if source == "" {
		return isLocalhost(remoteHost(r.RemoteAddr))
	}

	parsed, err := url.Parse(source)
	if err != nil || parsed.Host == "" {
		return false
	}

	sourceHost := strings.ToLower(parsed.Hostname())
	requestHost := strings.ToLower(hostname(r.Host))

	return sourceHost == requestHost || isLocalhost(sourceHost)
}

func hostname(host string) string {
	if parsedHost, _, err := net.SplitHostPort(host); err == nil {
		return strings.Trim(parsedHost, "[]")
	}

	return strings.Trim(host, "[]")
}

func remoteHost(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return hostname(remoteAddr)
	}

	return strings.ToLower(host)
}

func isLocalhost(host string) bool {
	switch strings.ToLower(strings.Trim(host, "[]")) {
	case "localhost", "127.0.0.1", "::1":
		return true
	default:
		return false
	}
}

func noContent(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
	}
}
