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

func TestAPIKeyOwnerIsolation(t *testing.T) {
	t.Setenv(settingsDBEnv, t.TempDir()+"/db.sqlite")
	settings, err := NewSettingsService()
	if err != nil {
		t.Fatal(err)
	}
	defer settings.db.Close()

	aliceKey, _, err := settings.CreateAPIKey("Alice Deploy", nil, "alice")
	if err != nil {
		t.Fatal(err)
	}
	if aliceKey.Owner != "alice" {
		t.Fatalf("expected owner 'alice', got %q", aliceKey.Owner)
	}

	bobKey, _, err := settings.CreateAPIKey("Bob Deploy", nil, "bob")
	if err != nil {
		t.Fatal(err)
	}
	if bobKey.Owner != "bob" {
		t.Fatalf("expected owner 'bob', got %q", bobKey.Owner)
	}

	// Root sees all
	allKeys, err := settings.APIKeys()
	if err != nil || len(allKeys) != 2 {
		t.Fatalf("expected 2 keys, got %d", len(allKeys))
	}

	// Alice only sees Alice's keys
	aliceKeys, err := settings.APIKeys("alice")
	if err != nil || len(aliceKeys) != 1 || aliceKeys[0].ID != aliceKey.ID {
		t.Fatalf("expected 1 alice key, got %+v", aliceKeys)
	}

	// Bob cannot delete Alice's key
	if err := settings.DeleteAPIKey(aliceKey.ID, "bob"); err == nil {
		t.Fatal("expected error when bob tries to delete alice's key")
	}

	// Bob cannot update Alice's key
	if err := settings.SetAPIKeyEnabled(aliceKey.ID, false, "bob"); err == nil {
		t.Fatal("expected error when bob tries to disable alice's key")
	}

	// Alice can delete Alice's key
	if err := settings.DeleteAPIKey(aliceKey.ID, "alice"); err != nil {
		t.Fatalf("alice should be able to delete her key: %v", err)
	}
}
