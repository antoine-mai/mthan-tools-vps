package services

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

var appPackages = map[string]map[string][][]string{
	"apt-get": {
		"nginx": {{"nginx"}}, "mariadb": {{"mariadb-server"}}, "php": {{"php-fpm", "php-cli"}}, "redis": {{"redis-server"}},
		"docker": {{"docker.io"}, {"docker-ce"}}, "podman": {{"podman"}}, "node": {{"nodejs", "npm"}},
	},
	"dnf": {
		"nginx": {{"nginx"}}, "mariadb": {{"mariadb-server"}}, "php": {{"php-fpm", "php-cli"}}, "redis": {{"redis"}},
		"docker": {{"docker"}, {"moby-engine"}, {"docker-ce"}}, "podman": {{"podman"}}, "node": {{"nodejs", "npm"}},
	},
	"yum": {
		"nginx": {{"nginx"}}, "mariadb": {{"mariadb-server"}}, "php": {{"php-fpm", "php-cli"}}, "redis": {{"redis"}},
		"docker": {{"docker"}, {"moby-engine"}, {"docker-ce"}}, "podman": {{"podman"}}, "node": {{"nodejs", "npm"}},
	},
	"pacman": {
		"nginx": {{"nginx"}}, "mariadb": {{"mariadb"}}, "php": {{"php", "php-fpm"}}, "redis": {{"redis"}},
		"docker": {{"docker"}}, "podman": {{"podman"}}, "node": {{"nodejs", "npm"}},
	},
}

func InstallApp(name string) error {
	manager := packageManager()
	if manager == "" {
		return errors.New("no supported package manager found")
	}
	options := appPackages[manager][name]
	if len(options) == 0 {
		return errors.New("unsupported app")
	}
	if manager == "apt-get" {
		cmd := exec.Command(manager, "update")
		cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive")
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("package index update failed: %s", conciseCommandOutput(output))
		}
	}
	var lastOutput []byte
	for _, packages := range options {
		args := installArguments(manager, packages)
		cmd := exec.Command(manager, args...)
		cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive")
		output, err := cmd.CombinedOutput()
		if err == nil {
			return nil
		}
		lastOutput = output
	}
	return fmt.Errorf("app installation failed: %s", conciseCommandOutput(lastOutput))
}

func packageManager() string {
	for _, manager := range []string{"apt-get", "dnf", "yum", "pacman"} {
		if _, err := exec.LookPath(manager); err == nil {
			return manager
		}
	}
	return ""
}

func installArguments(manager string, packages []string) []string {
	if manager == "pacman" {
		return append([]string{"-Sy", "--noconfirm", "--needed"}, packages...)
	}
	return append([]string{"install", "-y"}, packages...)
}

func conciseCommandOutput(output []byte) string {
	value := strings.TrimSpace(string(output))
	if len(value) > 1000 {
		value = value[len(value)-1000:]
	}
	if value == "" {
		return "package manager returned an error"
	}
	return value
}
