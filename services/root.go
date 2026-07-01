package services

import (
	"os"
	"os/user"
	"strconv"
)

type StartupConfig struct {
	Addr        string
	Env         string
	Mode        string
	PostBaseURL string
	UID         int
	Username    string
	IsRoot      bool
}

type StartupService interface {
	Startup() StartupConfig
}

type RootService struct{}

func NewStartupService() StartupService {
	if os.Geteuid() == 0 {
		return NewRootService()
	}

	return NewUserService()
}

func NewRootService() *RootService {
	return &RootService{}
}

func (s *RootService) Startup() StartupConfig {
	return startupConfig("root", true)
}

func startupConfig(mode string, isRoot bool) StartupConfig {
	uid := os.Geteuid()

	return StartupConfig{
		Addr:        getEnv("APP_ADDR", ":8000"),
		Env:         getEnv("APP_ENV", "development"),
		Mode:        mode,
		PostBaseURL: os.Getenv("POST_BASE_URL"),
		UID:         uid,
		Username:    username(uid),
		IsRoot:      isRoot,
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}

func username(uid int) string {
	currentUser, err := user.LookupId(strconv.Itoa(uid))
	if err != nil {
		return strconv.Itoa(uid)
	}

	return currentUser.Username
}
