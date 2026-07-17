package services

import (
	"strings"
	"testing"
)

func TestAPIKeyLifecycle(t *testing.T) {
	t.Setenv(settingsDBEnv, t.TempDir()+"/db.sqlite")
	settings, err := NewSettingsService()
	if err != nil {
		t.Fatal(err)
	}
	defer settings.db.Close()

	key, secret, err := settings.CreateAPIKey("Deploy automation", []string{"127.0.0.1", "10.0.0.0/8"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(secret, "mthan_") || !strings.HasPrefix(secret, key.KeyPrefix) {
		t.Fatalf("unexpected secret or prefix: secret=%q prefix=%q", secret, key.KeyPrefix)
	}

	keys, err := settings.APIKeys()
	if err != nil || len(keys) != 1 || !keys[0].Enabled {
		t.Fatalf("APIKeys() = %+v, %v", keys, err)
	}
	if len(keys[0].AcceptedIPs) != 2 || keys[0].AcceptedIPs[1] != "10.0.0.0/8" {
		t.Fatalf("accepted IPs = %v", keys[0].AcceptedIPs)
	}
	if err := settings.SetAPIKeyAcceptedIPs(key.ID, []string{"192.168.1.5"}); err != nil {
		t.Fatal(err)
	}
	if err := settings.SetAPIKeyEnabled(key.ID, false); err != nil {
		t.Fatal(err)
	}
	keys, _ = settings.APIKeys()
	if keys[0].Enabled {
		t.Fatal("expected disabled API key")
	}
	if err := settings.DeleteAPIKey(key.ID); err != nil {
		t.Fatal(err)
	}
	keys, _ = settings.APIKeys()
	if len(keys) != 0 {
		t.Fatalf("expected no API keys, got %+v", keys)
	}
}
