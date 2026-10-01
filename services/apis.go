package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net"
	"strings"
)

type APIKey struct {
	AcceptedIPs []string `json:"acceptedIps"`
	CreatedAt   string   `json:"createdAt"`
	Enabled     bool     `json:"enabled"`
	ID          string   `json:"id"`
	KeyPrefix   string   `json:"keyPrefix"`
	LastUsedAt  *string  `json:"lastUsedAt"`
	Name        string   `json:"name"`
	Owner       string   `json:"owner"`
}

func (s *SettingsService) APIKeys(owner ...string) ([]APIKey, error) {
	query := `SELECT id, name, key_prefix, owner, accepted_ips, enabled,
		CAST(created_at AS TEXT), CAST(last_used_at AS TEXT)
		FROM apis`
	var args []any
	if len(owner) > 0 && strings.TrimSpace(owner[0]) != "" {
		query += " WHERE owner = ?"
		args = append(args, strings.TrimSpace(owner[0]))
	}
	query += " ORDER BY created_at DESC, name ASC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	keys := make([]APIKey, 0)
	for rows.Next() {
		var key APIKey
		var acceptedIPs string
		if err := rows.Scan(&key.ID, &key.Name, &key.KeyPrefix, &key.Owner, &acceptedIPs, &key.Enabled, &key.CreatedAt, &key.LastUsedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(acceptedIPs), &key.AcceptedIPs); err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}
	return keys, rows.Err()
}

func (s *SettingsService) CreateAPIKey(name string, acceptedIPs []string, owner ...string) (APIKey, string, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 80 {
		return APIKey{}, "", errors.New("invalid API key name")
	}
	keyOwner := "root"
	if len(owner) > 0 && strings.TrimSpace(owner[0]) != "" {
		keyOwner = strings.TrimSpace(owner[0])
	}
	acceptedIPs, err := validAcceptedIPs(acceptedIPs)
	if err != nil {
		return APIKey{}, "", err
	}
	acceptedIPsJSON, err := json.Marshal(acceptedIPs)
	if err != nil {
		return APIKey{}, "", err
	}

	id, err := randomHex(16)
	if err != nil {
		return APIKey{}, "", err
	}
	randomSecret, err := randomHex(32)
	if err != nil {
		return APIKey{}, "", err
	}
	secret := "mthan_" + randomSecret
	hash := sha256.Sum256([]byte(secret))
	prefix := secret[:14]

	if _, err := s.db.Exec(`INSERT INTO apis (id, name, key_hash, key_prefix, owner, accepted_ips)
		VALUES (?, ?, ?, ?, ?, ?)`, id, name, hex.EncodeToString(hash[:]), prefix, keyOwner, string(acceptedIPsJSON)); err != nil {
		return APIKey{}, "", err
	}

	var key APIKey
	var acceptedIPsValue string
	if err := s.db.QueryRow(`SELECT id, name, key_prefix, owner, accepted_ips, enabled,
		CAST(created_at AS TEXT), CAST(last_used_at AS TEXT) FROM apis WHERE id = ?`, id).
		Scan(&key.ID, &key.Name, &key.KeyPrefix, &key.Owner, &acceptedIPsValue, &key.Enabled, &key.CreatedAt, &key.LastUsedAt); err != nil {
		return APIKey{}, "", err
	}
	if err := json.Unmarshal([]byte(acceptedIPsValue), &key.AcceptedIPs); err != nil {
		return APIKey{}, "", err
	}
	return key, secret, nil
}

func (s *SettingsService) SetAPIKeyAcceptedIPs(id string, acceptedIPs []string, owner ...string) error {
	acceptedIPs, err := validAcceptedIPs(acceptedIPs)
	if err != nil {
		return err
	}
	value, err := json.Marshal(acceptedIPs)
	if err != nil {
		return err
	}
	query := `UPDATE apis SET accepted_ips = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	args := []any{string(value), id}
	if len(owner) > 0 && strings.TrimSpace(owner[0]) != "" {
		query += " AND owner = ?"
		args = append(args, strings.TrimSpace(owner[0]))
	}
	result, err := s.db.Exec(query, args...)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("API key not found")
	}
	return nil
}

func (s *SettingsService) SetAPIKeyEnabled(id string, enabled bool, owner ...string) error {
	query := `UPDATE apis SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	args := []any{enabled, id}
	if len(owner) > 0 && strings.TrimSpace(owner[0]) != "" {
		query += " AND owner = ?"
		args = append(args, strings.TrimSpace(owner[0]))
	}
	result, err := s.db.Exec(query, args...)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("API key not found")
	}
	return nil
}

func (s *SettingsService) DeleteAPIKey(id string, owner ...string) error {
	query := "DELETE FROM apis WHERE id = ?"
	args := []any{id}
	if len(owner) > 0 && strings.TrimSpace(owner[0]) != "" {
		query += " AND owner = ?"
		args = append(args, strings.TrimSpace(owner[0]))
	}
	result, err := s.db.Exec(query, args...)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("API key not found")
	}
	return nil
}

func randomHex(size int) (string, error) {
	value := make([]byte, size)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func validAcceptedIPs(values []string) ([]string, error) {
	result := make([]string, 0, len(values))
	seen := make(map[string]bool)
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if net.ParseIP(value) == nil {
			if _, _, err := net.ParseCIDR(value); err != nil {
				return nil, errors.New("accepted IP must be an IP address or CIDR range")
			}
		}
		if !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	return result, nil
}
