package post

import (
	"net/http"
	"testing"

	"mthan/vps/services"
)

func TestRegisterDoesNotPanic(t *testing.T) {
	mux := http.NewServeMux()

	Register(mux, Dependencies{
		Auth:     services.NewAuthService(),
		Sessions: services.NewSessionService(),
		Startup:  services.StartupConfig{IsRoot: true},
		Update:   services.NewUpdateService("", ""),
	})
}
