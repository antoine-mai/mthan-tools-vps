package routes

import (
	"embed"
	"net/http"

	"mthan/vps/routes/api"
	"mthan/vps/routes/post"
	"mthan/vps/services"
	"mthan/vps/services/router"
)

type Dependencies struct {
	Auth     *services.AuthService
	ClientFS embed.FS
	Health   *services.HealthService
	Sessions *services.SessionService
	Startup  services.StartupConfig
	Update   *services.UpdateService
	System   *services.SystemService
}

func Register(mux *http.ServeMux, deps Dependencies) {
	api.Register(mux, api.Dependencies{
		Health:      deps.Health,
		PostBaseURL: router.PostBaseURL(deps.Startup),
		Sessions:    deps.Sessions,
		System:      deps.System,
	})

	post.Register(mux, post.Dependencies{
		Auth:     deps.Auth,
		Sessions: deps.Sessions,
		Startup:  deps.Startup,
		Update:   deps.Update,
		System:   deps.System,
	})

	router.Register(mux, deps.Startup, deps.ClientFS)
}
