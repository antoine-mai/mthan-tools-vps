package services

import (
	"bufio"
	"errors"
	"os"
	"os/user"
	"strconv"
	"strings"
)

var (
	ErrAuthUnavailable    = errors.New("auth unavailable")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

type LoginCredentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthenticatedUser struct {
	HomeDir  string `json:"homeDir"`
	UID      int    `json:"uid"`
	Username string `json:"username"`
}

type AuthService struct {
	shadowPath string
}

func NewAuthService() *AuthService {
	return &AuthService{
		shadowPath: "/etc/shadow",
	}
}

func (s *AuthService) AuthenticateLinuxUser(credentials LoginCredentials) (AuthenticatedUser, error) {
	username := strings.TrimSpace(credentials.Username)
	if username == "" || credentials.Password == "" || strings.Contains(username, ":") {
		return AuthenticatedUser{}, ErrInvalidCredentials
	}

	shadowHash, err := s.shadowHash(username)
	if err != nil {
		return AuthenticatedUser{}, err
	}

	if shadowHash == "" || strings.HasPrefix(shadowHash, "!") || strings.HasPrefix(shadowHash, "*") {
		return AuthenticatedUser{}, ErrInvalidCredentials
	}

	matched, err := verifyPasswordHash(credentials.Password, shadowHash)
	if err != nil {
		return AuthenticatedUser{}, err
	}

	if !matched {
		return AuthenticatedUser{}, ErrInvalidCredentials
	}

	currentUser, err := user.Lookup(username)
	if err != nil {
		return AuthenticatedUser{}, ErrInvalidCredentials
	}

	uid, err := strconv.Atoi(currentUser.Uid)
	if err != nil {
		return AuthenticatedUser{}, ErrInvalidCredentials
	}

	return AuthenticatedUser{
		HomeDir:  currentUser.HomeDir,
		UID:      uid,
		Username: currentUser.Username,
	}, nil
}

func (s *AuthService) shadowHash(username string) (string, error) {
	file, err := os.Open(s.shadowPath)
	if err != nil {
		if os.IsPermission(err) {
			return "", ErrAuthUnavailable
		}

		return "", err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		parts := strings.SplitN(scanner.Text(), ":", 3)
		if len(parts) < 2 {
			continue
		}

		if parts[0] == username {
			return parts[1], nil
		}
	}

	if err := scanner.Err(); err != nil {
		return "", err
	}

	return "", ErrInvalidCredentials
}
