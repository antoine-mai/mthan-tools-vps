package post

import (
	"net/http"
)

func registerLogin(mux *http.ServeMux, deps Dependencies) {
	mux.Handle("POST /post/login", postOnly(deps.Startup, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := authenticate(w, r, deps.Auth)
		if !ok {
			return
		}

		session, err := deps.Sessions.Create(user, "root")
		if err != nil {
			http.Error(w, "session could not be created", http.StatusInternalServerError)
			return
		}

		setSessionCookie(w, r, deps.Sessions, session)
		writeJSON(w, http.StatusOK, loginResponse{
			Session: &session,
			Status:  "ok",
			User:    user,
		})
	})))
}
