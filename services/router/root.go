package router

import (
	"io/fs"
	"net/http"
	"net/url"
	"strings"

	"mthan/vps/services"
)

func registerRootRoutes(mux *http.ServeMux, runtime ClientRuntime, sessions *services.SessionService, settings *services.SettingsService, embeddedFS fs.FS) {
	rootRuntime := runtime
	rootRuntime.BasePath = "/root"
	if settings != nil {
		rootRuntime.BasePath = settings.RootRoute()
	}

	rootHandler := clientHandler(
		rootRuntime,
		sessions,
		settings,
		embeddedFS,
		"client/build/root",
		"public/dist/client/root",
		"client/build",
		"public/dist/client",
	)

	userRuntime := runtime
	userRuntime.BasePath = ""
	userRuntime.IsRoot = false
	userRuntime.Mode = "user"
	userRuntime.UID = -1
	userRuntime.Username = ""
	userHandler := clientHandler(
		userRuntime,
		sessions,
		nil,
		embeddedFS,
		"client/build/user",
		"public/dist/client/user",
		"client/build",
		"public/dist/client",
	)

	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		rootPrefix := "/root"
		if settings != nil {
			rootPrefix = settings.RootRoute()
		}

		if r.URL.Path == rootPrefix || strings.HasPrefix(r.URL.Path, rootPrefix+"/") {
			r2 := new(http.Request)
			*r2 = *r
			r2.URL = new(url.URL)
			*r2.URL = *r.URL
			p := strings.TrimPrefix(r.URL.Path, rootPrefix)
			if !strings.HasPrefix(p, "/") {
				p = "/" + p
			}
			r2.URL.Path = p
			rootHandler.ServeHTTP(w, r2)
			return
		}

		userHandler.ServeHTTP(w, r)
	})
}
