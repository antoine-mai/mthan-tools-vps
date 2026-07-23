package router

import (
	"io/fs"
	"net/http"

	"mthan/vps/services"
)

func registerRootRoutes(mux *http.ServeMux, runtime ClientRuntime, sessions *services.SessionService, embeddedFS fs.FS) {
	rootRuntime := runtime
	rootRuntime.BasePath = "/root"
	rootHandler := clientHandler(
		rootRuntime,
		sessions,
		embeddedFS,
		"client/build/root",
		"public/dist/client/root",
		"client/build",
		"public/dist/client",
	)
	mux.Handle("GET /root", rootHandler)
	mux.Handle("GET /root/", http.StripPrefix("/root", rootHandler))

	userRuntime := runtime
	userRuntime.BasePath = ""
	userRuntime.IsRoot = false
	userRuntime.Mode = "user"
	userRuntime.UID = -1
	userRuntime.Username = ""
	registerUserRoutes(mux, userRuntime, sessions, embeddedFS)
}
