package services

import (
	"reflect"
	"testing"
)

func TestInstallArguments(t *testing.T) {
	if got := installArguments("apt-get", []string{"caddy"}); !reflect.DeepEqual(got, []string{"install", "-y", "caddy"}) {
		t.Fatalf("apt args = %v", got)
	}
	if got := installArguments("pacman", []string{"caddy"}); !reflect.DeepEqual(got, []string{"-Sy", "--noconfirm", "--needed", "caddy"}) {
		t.Fatalf("pacman args = %v", got)
	}
}

func TestEveryKnownAppHasPackages(t *testing.T) {
	for manager, apps := range appPackages {
		for _, app := range knownApps {
			if len(apps[app.name]) == 0 {
				t.Errorf("%s has no package plan for %s", manager, app.name)
			}
		}
	}
}
