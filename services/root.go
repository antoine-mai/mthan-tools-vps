package services

import (
	"bufio"
	"net"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
)

type StartupConfig struct {
	Addr        string
	Env         string
	Mode        string
	OSName      string
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
	port := loadOrInitializePort()

	return StartupConfig{
		Addr:        ":" + strconv.Itoa(port),
		Env:         getEnv("APP_ENV", "development"),
		Mode:        mode,
		OSName:      osName(),
		PostBaseURL: os.Getenv("POST_BASE_URL"),
		UID:         uid,
		Username:    username(uid),
		IsRoot:      isRoot,
	}
}

func loadOrInitializePort() int {
	home, err := os.UserHomeDir()
	if err != nil {
		return defaultPortFromEnv()
	}

	configDir := filepath.Join(home, ".mthan-vps")
	configPath := filepath.Join(configDir, "config.yaml")

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		_ = os.MkdirAll(configDir, 0700)
		port := defaultPortFromEnv()
		_ = os.WriteFile(configPath, []byte("port: "+strconv.Itoa(port)+"\n"), 0600)
		return port
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return defaultPortFromEnv()
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "port:") {
			valStr := strings.TrimSpace(strings.TrimPrefix(line, "port:"))
			if port, err := strconv.Atoi(valStr); err == nil {
				return port
			}
		}
	}

	return defaultPortFromEnv()
}

func defaultPortFromEnv() int {
	addr := os.Getenv("APP_ADDR")
	if addr == "" {
		return 2205
	}

	if _, portStr, err := net.SplitHostPort(addr); err == nil {
		if p, err := strconv.Atoi(portStr); err == nil {
			return p
		}
	}

	if strings.HasPrefix(addr, ":") {
		if p, err := strconv.Atoi(strings.TrimPrefix(addr, ":")); err == nil {
			return p
		}
	}

	if p, err := strconv.Atoi(addr); err == nil {
		return p
	}

	return 2205
}

func osName() string {
	file, err := os.Open("/etc/os-release")
	if err != nil {
		return "Linux"
	}
	defer file.Close()

	values := make(map[string]string)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		key, value, ok := strings.Cut(scanner.Text(), "=")
		if !ok {
			continue
		}
		values[key] = strings.Trim(value, `"`)
	}

	if name := values["PRETTY_NAME"]; name != "" {
		return name
	}
	if name := values["NAME"]; name != "" {
		return name
	}

	return "Linux"
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
