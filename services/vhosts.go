package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

var ErrVHostNotFound = errors.New("vhost not found")
var ErrVHostUpdateFailed = errors.New("caddy configuration update failed")

const (
	CaddyUsersDir  = "/etc/caddy/Caddyfile.d/mthan-users"
	CaddyfilePath  = "/etc/caddy/Caddyfile"
	CaddyImportDir = "import /etc/caddy/Caddyfile.d/mthan-users/*"
)

func UserCaddyfilePath(username string) string {
	return filepath.Join(CaddyUsersDir, username+".caddy")
}

func CreateUserCaddyfile(username string) error {
	if err := EnsureCaddyMThanUsers(); err != nil {
		return err
	}
	path := UserCaddyfilePath(username)
	if _, err := os.Stat(path); err == nil {
		return nil
	}
	content := fmt.Sprintf("# Virtual hosts for user: %s\n", username)
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return err
	}
	_ = exec.Command("caddy", "reload", "--config", CaddyfilePath).Run()
	return nil
}

func DeleteUserCaddyfile(username string) error {
	path := UserCaddyfilePath(username)
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	_ = exec.Command("caddy", "reload", "--config", CaddyfilePath).Run()
	return nil
}

func EnsureCaddyMThanUsers() error {
	if os.Geteuid() != 0 {
		return nil
	}

	if _, err := exec.LookPath("caddy"); err != nil {
		if _, statErr := os.Stat("/etc/caddy"); statErr != nil {
			return nil
		}
	}

	if err := os.MkdirAll(CaddyUsersDir, 0755); err != nil {
		return err
	}

	content, err := os.ReadFile(CaddyfilePath)
	if os.IsNotExist(err) {
		_ = os.MkdirAll("/etc/caddy", 0755)
		return os.WriteFile(CaddyfilePath, []byte(CaddyImportDir+"\n"), 0644)
	}
	if err != nil {
		return err
	}

	text := string(content)
	if !strings.Contains(text, CaddyImportDir) {
		updated := strings.TrimRight(text, "\r\n") + "\n\n" + CaddyImportDir + "\n"
		if err := os.WriteFile(CaddyfilePath, []byte(updated), 0644); err != nil {
			return err
		}
		_ = exec.Command("caddy", "reload", "--config", CaddyfilePath).Run()
	}

	if users, uErr := HomeUsers(); uErr == nil {
		for _, u := range users {
			if u.Username != "" && u.Username != "root" {
				userPath := UserCaddyfilePath(u.Username)
				if _, statErr := os.Stat(userPath); os.IsNotExist(statErr) {
					_ = os.WriteFile(userPath, []byte(fmt.Sprintf("# Virtual hosts for user: %s\n", u.Username)), 0644)
				}
			}
		}
	}

	return nil
}

type PublicPort struct {
	Port      int    `json:"port"`
	Protocol  string `json:"protocol"`
	Server    string `json:"server"`
	Listening bool   `json:"listening"`
}

type VHost struct {
	Hostname    string   `json:"hostname"`
	Aliases     []string `json:"aliases"`
	Server      string   `json:"server"`
	Listen      []string `json:"listen"`
	TLS         bool     `json:"tls"`
	Upstreams   []string `json:"upstreams"`
	Roots       []string `json:"roots"`
	ConfigFiles []string `json:"configFiles"`
}

type VHostSummary struct {
	Hostname string   `json:"hostname"`
	Aliases  []string `json:"aliases"`
	Server   string   `json:"server"`
	Listen   []string `json:"listen"`
	TLS      bool     `json:"tls"`
}

type VHostStatus struct {
	Proxy       string       `json:"proxy"`
	PublicPorts []PublicPort `json:"publicPorts"`
	VHosts      int          `json:"vhosts"`
}

type commandRunner interface {
	Run(name string, args ...string) ([]byte, error)
}

type timedCommandRunner struct{}

func (timedCommandRunner) Run(name string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return exec.CommandContext(ctx, name, args...).CombinedOutput()
}

type VHostService struct {
	runner commandRunner
}

func NewVHostService() *VHostService {
	_ = EnsureCaddyMThanUsers()
	return &VHostService{runner: timedCommandRunner{}}
}

func (s *VHostService) Status() VHostStatus {
	vhosts := s.List()
	ports := s.publicPorts()
	proxy := "caddy"
	return VHostStatus{Proxy: proxy, PublicPorts: ports, VHosts: len(vhosts)}
}

func (s *VHostService) List() []VHost {
	_ = EnsureCaddyMThanUsers()
	var all []VHost
	if output, err := s.runner.Run("caddy", "adapt", "--config", "/etc/caddy/Caddyfile"); err == nil {
		all = append(all, parseCaddyVHosts(output, "/etc/caddy/Caddyfile")...)
	}
	all = mergeVHosts(all)
	sort.Slice(all, func(i, j int) bool {
		if all[i].Hostname == all[j].Hostname {
			return all[i].Server < all[j].Server
		}
		return all[i].Hostname < all[j].Hostname
	})
	return all
}

func (s *VHostService) Summaries() []VHostSummary {
	vhosts := s.List()
	result := make([]VHostSummary, 0, len(vhosts))
	for _, host := range vhosts {
		result = append(result, VHostSummary{
			Hostname: host.Hostname, Aliases: host.Aliases, Server: host.Server,
			Listen: host.Listen, TLS: host.TLS,
		})
	}
	return result
}

func (s *VHostService) Get(hostname string) (VHost, error) {
	_ = EnsureCaddyMThanUsers()
	hostname = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(hostname), "."))
	for _, host := range s.List() {
		if strings.EqualFold(host.Hostname, hostname) || containsFold(host.Aliases, hostname) {
			return host, nil
		}
	}
	return VHost{}, ErrVHostNotFound
}

func (s *VHostService) Delete(hostname string) error {
	_ = EnsureCaddyMThanUsers()
	hostname = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(hostname), "."))
	path := "/etc/caddy/Caddyfile"
	content, err := os.ReadFile(path)
	if err == nil {
		if updated, found := removeCaddySiteBlock(string(content), hostname); found {
			configs := NewAppConfigService()
			if _, writeErr := configs.Write("caddy", path, updated); writeErr != nil {
				return writeErr
			}
			if _, reloadErr := s.runner.Run("caddy", "reload", "--config", path); reloadErr != nil {
				_, _ = configs.Write("caddy", path, string(content))
				_, _ = s.runner.Run("caddy", "reload", "--config", path)
				return ErrVHostUpdateFailed
			}
			return nil
		}
	}

	entries, readErr := os.ReadDir(CaddyUsersDir)
	if readErr == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			userConfPath := filepath.Join(CaddyUsersDir, entry.Name())
			fileContent, readErr := os.ReadFile(userConfPath)
			if readErr != nil {
				continue
			}
			if updated, found := removeCaddySiteBlock(string(fileContent), hostname); found {
				if strings.TrimSpace(updated) == "" {
					_ = os.Remove(userConfPath)
				} else {
					_ = os.WriteFile(userConfPath, []byte(updated), 0644)
				}
				if _, reloadErr := s.runner.Run("caddy", "reload", "--config", path); reloadErr != nil {
					_ = os.WriteFile(userConfPath, fileContent, 0644)
					return ErrVHostUpdateFailed
				}
				return nil
			}
		}
	}

	return ErrVHostNotFound
}

func (s *VHostService) Reload() error {
	_ = EnsureCaddyMThanUsers()
	if _, err := s.runner.Run("caddy", "reload", "--config", "/etc/caddy/Caddyfile"); err != nil {
		return ErrVHostUpdateFailed
	}
	return nil
}

func removeCaddySiteBlock(content, hostname string) (string, bool) {
	depth, start := 0, -1
	var quote byte
	escaped, comment := false, false
	for i := 0; i < len(content); i++ {
		char := content[i]
		if comment {
			if char == '\n' {
				comment = false
			}
			continue
		}
		if escaped {
			escaped = false
			continue
		}
		if quote != 0 {
			if char == '\\' {
				escaped = true
			} else if char == quote {
				quote = 0
			}
			continue
		}
		if char == '#' {
			comment = true
			continue
		}
		if char == '"' || char == '\'' {
			quote = char
			continue
		}
		switch char {
		case '{':
			if depth == 0 {
				start = strings.LastIndex(content[:i], "\n") + 1
			}
			depth++
		case '}':
			if depth == 0 {
				continue
			}
			depth--
			if depth == 0 && start >= 0 {
				brace := strings.Index(content[start:i], "{")
				if brace < 0 {
					continue
				}
				label := strings.TrimSpace(content[start : start+brace])
				for _, address := range strings.Split(label, ",") {
					candidate := strings.TrimSpace(address)
					candidate = strings.TrimPrefix(candidate, "http://")
					candidate = strings.TrimPrefix(candidate, "https://")
					candidate = strings.Split(candidate, ":")[0]
					if strings.EqualFold(strings.TrimSuffix(candidate, "."), hostname) {
						end := i + 1
						for end < len(content) && (content[end] == '\n' || content[end] == '\r') {
							end++
						}
						return content[:start] + content[end:], true
					}
				}
				start = -1
			}
		}
	}
	return content, false
}

func (s *VHostService) publicPorts() []PublicPort {
	ports := []PublicPort{
		{Port: 80, Protocol: "http", Server: "unknown"},
		{Port: 443, Protocol: "https", Server: "unknown"},
	}
	output, err := s.runner.Run("ss", "-H", "-ltnp")
	if err != nil {
		return ports
	}
	for i := range ports {
		server, listening := serverForPort(string(output), ports[i].Port)
		ports[i].Server = server
		ports[i].Listening = listening
	}
	return ports
}

func serverForPort(output string, port int) (string, bool) {
	portPattern := regexp.MustCompile(`(?:\]:|:)(` + strconv.Itoa(port) + `)\s`)
	for _, line := range strings.Split(output, "\n") {
		if !portPattern.MatchString(line + " ") {
			continue
		}
		lower := strings.ToLower(line)
		for _, candidate := range []struct{ process, server string }{
			{"caddy", "caddy"}, {"apache2", "apache"}, {"httpd", "apache"},
		} {
			if strings.Contains(lower, `"`+candidate.process+`"`) {
				return candidate.server, true
			}
		}
		return "unknown", true
	}
	return "unknown", false
}

var apacheHostPattern = regexp.MustCompile(`(?m)port\s+(\d+)\s+namevhost\s+(\S+)\s+\((.+):\d+\)`)

func parseApacheVHosts(output string) []VHost {
	var result []VHost
	for _, match := range apacheHostPattern.FindAllStringSubmatch(output, -1) {
		port := match[1]
		result = append(result, VHost{
			Hostname: match[2], Server: "apache", Listen: []string{":" + port},
			TLS: port == "443", ConfigFiles: []string{match[3]},
		})
	}
	return result
}

func parseCaddyVHosts(output []byte, configFile string) []VHost {
	var config map[string]any
	if json.Unmarshal(output, &config) != nil {
		return nil
	}
	httpApp := nestedMap(config, "apps", "http")
	servers, _ := httpApp["servers"].(map[string]any)
	var result []VHost
	for _, rawServer := range servers {
		server, _ := rawServer.(map[string]any)
		listen := stringArray(server["listen"])
		routes, _ := server["routes"].([]any)
		for _, rawRoute := range routes {
			route, _ := rawRoute.(map[string]any)
			hosts := caddyRouteHosts(route)
			if len(hosts) == 0 {
				continue
			}
			upstreams, roots := caddyRouteTargets(route)
			result = append(result, VHost{
				Hostname: hosts[0], Aliases: hosts[1:], Server: "caddy", Listen: listen,
				TLS: listensTLS(listen), Upstreams: upstreams, Roots: roots,
				ConfigFiles: []string{configFile},
			})
		}
	}
	return result
}

func caddyRouteHosts(route map[string]any) []string {
	var hosts []string
	matchers, _ := route["match"].([]any)
	for _, raw := range matchers {
		matcher, _ := raw.(map[string]any)
		hosts = append(hosts, stringArray(matcher["host"])...)
	}
	return uniqueStrings(hosts)
}

func caddyRouteTargets(value any) ([]string, []string) {
	var upstreams, roots []string
	var walk func(any)
	walk = func(node any) {
		switch current := node.(type) {
		case []any:
			for _, child := range current {
				walk(child)
			}
		case map[string]any:
			if current["handler"] == "reverse_proxy" {
				for _, raw := range anyArray(current["upstreams"]) {
					upstream, _ := raw.(map[string]any)
					if dial, ok := upstream["dial"].(string); ok {
						upstreams = append(upstreams, dial)
					}
				}
			}
			if current["handler"] == "file_server" {
				if root, ok := current["root"].(string); ok {
					roots = append(roots, root)
				}
			}
			for _, child := range current {
				walk(child)
			}
		}
	}
	walk(value)
	return uniqueStrings(upstreams), uniqueStrings(roots)
}

func nestedMap(value map[string]any, keys ...string) map[string]any {
	current := value
	for _, key := range keys {
		next, _ := current[key].(map[string]any)
		current = next
	}
	return current
}

func anyArray(value any) []any { result, _ := value.([]any); return result }
func stringArray(value any) []string {
	var result []string
	for _, item := range anyArray(value) {
		if text, ok := item.(string); ok {
			result = append(result, text)
		}
	}
	return result
}

func listensTLS(listen []string) bool {
	for _, value := range listen {
		if strings.Contains(value, "443") || strings.EqualFold(value, "ssl") {
			return true
		}
	}
	return false
}

func mergeVHosts(input []VHost) []VHost {
	result := make([]VHost, 0, len(input))
	index := map[string]int{}
	for _, host := range input {
		host.Hostname = strings.ToLower(strings.TrimSuffix(host.Hostname, "."))
		key := host.Server + "\x00" + host.Hostname
		if existing, ok := index[key]; ok {
			current := &result[existing]
			current.Aliases = uniqueStrings(append(current.Aliases, host.Aliases...))
			current.Listen = uniqueStrings(append(current.Listen, host.Listen...))
			current.Upstreams = uniqueStrings(append(current.Upstreams, host.Upstreams...))
			current.Roots = uniqueStrings(append(current.Roots, host.Roots...))
			current.ConfigFiles = uniqueStrings(append(current.ConfigFiles, host.ConfigFiles...))
			current.TLS = current.TLS || host.TLS
			continue
		}
		index[key] = len(result)
		result = append(result, host)
	}
	return result
}

func uniqueStrings(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	return result
}

func containsFold(values []string, target string) bool {
	for _, value := range values {
		if strings.EqualFold(value, target) {
			return true
		}
	}
	return false
}

func nonEmptySlice(value string) []string {
	if value == "" {
		return nil
	}
	return []string{value}
}
