package services

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)


func TestParseCaddyVHosts(t *testing.T) {
	config := map[string]any{"apps": map[string]any{"http": map[string]any{"servers": map[string]any{
		"srv0": map[string]any{
			"listen": []any{":443"},
			"routes": []any{map[string]any{
				"match":  []any{map[string]any{"host": []any{"example.com", "www.example.com"}}},
				"handle": []any{map[string]any{"handler": "reverse_proxy", "upstreams": []any{map[string]any{"dial": "127.0.0.1:8080"}}}},
			}},
		},
	}}}}
	output, _ := json.Marshal(config)
	hosts := parseCaddyVHosts(output, "/etc/caddy/Caddyfile")
	if len(hosts) != 1 {
		t.Fatalf("got %d hosts, want 1", len(hosts))
	}
	if hosts[0].Hostname != "example.com" || !hosts[0].TLS {
		t.Fatalf("unexpected host: %#v", hosts[0])
	}
	if !reflect.DeepEqual(hosts[0].Upstreams, []string{"127.0.0.1:8080"}) {
		t.Fatalf("unexpected upstreams: %#v", hosts[0].Upstreams)
	}
}

func TestRemoveCaddySiteBlock(t *testing.T) {
	input := "example.com, www.example.com {\n\treverse_proxy localhost:3000\n}\n\nother.test {\n\troot * /srv/example.com\n}\n"
	got, found := removeCaddySiteBlock(input, "www.example.com")
	if !found {
		t.Fatal("expected site block to be found")
	}
	if strings.Contains(got, "reverse_proxy") || !strings.Contains(got, "other.test") {
		t.Fatalf("unexpected Caddyfile after deletion: %q", got)
	}
}

func TestRemoveCaddySiteBlockDoesNotMatchDirective(t *testing.T) {
	input := "other.test {\n\treverse_proxy example.com:3000\n}\n"
	got, found := removeCaddySiteBlock(input, "example.com")
	if found || got != input {
		t.Fatal("directive value must not be treated as a site address")
	}
}

func TestParseApacheVHosts(t *testing.T) {
	output := `*:80 is a NameVirtualHost
         port 80 namevhost example.com (/etc/apache2/sites-enabled/example.conf:1)
         port 443 namevhost secure.example.com (/etc/apache2/sites-enabled/secure.conf:2)`
	hosts := parseApacheVHosts(output)
	if len(hosts) != 2 {
		t.Fatalf("got %d hosts, want 2", len(hosts))
	}
	if hosts[0].TLS || !hosts[1].TLS {
		t.Fatalf("unexpected TLS values: %#v", hosts)
	}
}

func TestServerForPort(t *testing.T) {
	output := `LISTEN 0 4096 *:80 *:* users:(("caddy",pid=8,fd=6))
LISTEN 0 4096 *:443 *:* users:(("caddy",pid=8,fd=7))`
	if server, listening := serverForPort(output, 80); server != "caddy" || !listening {
		t.Fatalf("port 80 = %q, %v", server, listening)
	}
	if server, listening := serverForPort(output, 443); server != "caddy" || !listening {
		t.Fatalf("port 443 = %q, %v", server, listening)
	}
}

func TestCaddyConstants(t *testing.T) {
	if !strings.Contains(CaddyImportDir, "mthan-users") {
		t.Fatalf("unexpected CaddyImportDir: %s", CaddyImportDir)
	}
	if CaddyUsersDir != "/etc/caddy/mthan-users" {
		t.Fatalf("unexpected CaddyUsersDir: %s", CaddyUsersDir)
	}
	expected := "/etc/caddy/mthan-users/testuser.caddy"
	if UserCaddyfilePath("testuser") != expected {
		t.Fatalf("UserCaddyfilePath(testuser) = %q, want %q", UserCaddyfilePath("testuser"), expected)
	}
}

func TestExtractCaddyHostnames(t *testing.T) {
	input := `# Comment
alice.example.com, www.alice.example.com {
	reverse_proxy localhost:8080
}

http://sub.domain.com:8443 {
	file_server
}
`
	hosts := extractCaddyHostnames(input)
	expected := []string{"alice.example.com", "www.alice.example.com", "sub.domain.com"}
	if !reflect.DeepEqual(hosts, expected) {
		t.Fatalf("extractCaddyHostnames() = %v, want %v", hosts, expected)
	}
}
