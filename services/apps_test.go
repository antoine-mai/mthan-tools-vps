package services

import (
	"testing"
)

func TestKnownAppsIncludeWebServersAndContainers(t *testing.T) {
	want := []string{"caddy", "podman"}
	found := make(map[string]appDefinition, len(knownApps))
	for _, app := range knownApps {
		found[app.name] = app
	}

	for _, name := range want {
		if _, ok := found[name]; !ok {
			t.Errorf("knownApps does not contain %q", name)
		}
	}
}

func TestPodmanIsNotManagedAsRootService(t *testing.T) {
	for _, app := range knownApps {
		if app.name == "podman" && len(app.services) != 0 {
			t.Fatalf("Podman services = %v, want none for per-user rootless isolation", app.services)
		}
	}
}

func TestSemanticVersionPattern(t *testing.T) {
	for _, test := range []struct {
		output string
		want   string
	}{
		{output: "v2.8.4", want: "2.8.4"},
		{output: "v22.14.0", want: "22.14.0"},
	} {
		if got := semanticVersionPattern.FindString(test.output); got != test.want {
			t.Errorf("version from %q = %q, want %q", test.output, got, test.want)
		}
	}
}
