package services

import (
	"reflect"
	"testing"
)

func TestInstallArguments(t *testing.T) {
	if got := installArguments("apt-get", []string{"nginx"}); !reflect.DeepEqual(got, []string{"install", "-y", "nginx"}) {
		t.Fatalf("apt args = %v", got)
	}
	if got := installArguments("pacman", []string{"nginx"}); !reflect.DeepEqual(got, []string{"-Sy", "--noconfirm", "--needed", "nginx"}) {
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
