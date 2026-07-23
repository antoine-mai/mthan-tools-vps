package router

import (
	"io/fs"
	"net/http"

	"mthan/vps/services"
)

func registerUserRoutes(mux *http.ServeMux, runtime ClientRuntime, sessions *services.SessionService, embeddedFS fs.FS) {
	mux.Handle("GET /", clientHandler(
		runtime,
		sessions,
		embeddedFS,
		"client/build/user",
		"public/dist/client/user",
		"client/build",
		"public/dist/client",
	))
}
