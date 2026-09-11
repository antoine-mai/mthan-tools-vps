package services

import (
	"reflect"
	"testing"
)

func TestParseRootPodmanContainers(t *testing.T) {
	output := []byte(`[{
        "Id":"root123",
        "Names":["caddy-proxy"],
        "Image":"docker.io/library/caddy:latest",
        "Command":["caddy","run"],
        "State":"running",
        "Status":"Up 1 hour",
        "CreatedAt":1753000000,
        "Ports":[{"host_ip":"0.0.0.0","host_port":80,"container_port":80,"protocol":"tcp"}]
    }]`)
	containers := parsePodmanContainers(output, "root")
	if len(containers) != 1 {
		t.Fatalf("got %d containers, want 1", len(containers))
	}
	got := containers[0]
	if got.Engine != "podman" || got.Owner != "root" || got.Name != "caddy-proxy" || got.State != "running" {
		t.Fatalf("unexpected container: %#v", got)
	}
	if !reflect.DeepEqual(got.Ports, []string{"0.0.0.0:80->80/tcp"}) {
		t.Fatalf("unexpected ports: %#v", got.Ports)
	}
}

func TestParsePodmanContainers(t *testing.T) {
	output := []byte(`[{
        "Id":"def456",
        "Names":["api"],
        "Image":"docker.io/library/node:22",
        "Command":["node","server.js"],
        "State":"running",
        "Status":"Up 5 minutes",
        "CreatedAt":1753005600,
        "Ports":[{"host_ip":"127.0.0.1","host_port":3000,"container_port":3000,"protocol":"tcp"}]
    }]`)
	containers := parsePodmanContainers(output, "alice")
	if len(containers) != 1 {
		t.Fatalf("got %d containers, want 1", len(containers))
	}
	got := containers[0]
	if got.Engine != "podman" || got.Owner != "alice" || got.Name != "api" || got.Command != "node server.js" {
		t.Fatalf("unexpected container: %#v", got)
	}
	if !reflect.DeepEqual(got.Ports, []string{"127.0.0.1:3000->3000/tcp"}) {
		t.Fatalf("unexpected ports: %#v", got.Ports)
	}
}
