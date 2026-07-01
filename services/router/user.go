package router

import "net/http"

func registerUserRoutes(mux *http.ServeMux, runtime ClientRuntime) {
	mux.Handle("GET /", clientHandler(
		runtime,
		"client/build/user",
		"bin/client/user",
		"client/build",
		"bin/client",
	))
}
