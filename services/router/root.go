package router

import "net/http"

func registerRootRoutes(mux *http.ServeMux, runtime ClientRuntime) {
	mux.Handle("GET /", clientHandler(
		runtime,
		"client/build/root",
		"bin/client/root",
		"client/build",
		"bin/client",
	))
}
