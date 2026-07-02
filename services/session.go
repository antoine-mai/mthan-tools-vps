package services

import (
	"crypto/rand"
	"encoding/base64"
	"sync"
	"time"
)

const SessionCookieName = "vps_session"

type Session struct {
	ExpiresAt time.Time `json:"expiresAt"`
	Mode      string    `json:"mode"`
	Token     string    `json:"-"`
	UID       int       `json:"uid"`
	Username  string    `json:"username"`
}

type SessionService struct {
	mu       sync.RWMutex
	sessions map[string]Session
	ttl      time.Duration
}

func NewSessionService() *SessionService {
	return &SessionService{
		sessions: make(map[string]Session),
		ttl:      24 * time.Hour,
	}
}

func (s *SessionService) Create(user AuthenticatedUser, mode string) (Session, error) {
	token, err := sessionToken()
	if err != nil {
		return Session{}, err
	}

	session := Session{
		ExpiresAt: time.Now().Add(s.ttl),
		Mode:      mode,
		Token:     token,
		UID:       user.UID,
		Username:  user.Username,
	}

	s.mu.Lock()
	s.sessions[token] = session
	s.mu.Unlock()

	return session, nil
}

func (s *SessionService) Get(token string) (Session, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, exists := s.sessions[token]
	if !exists {
		return Session{}, false
	}
	if time.Now().After(session.ExpiresAt) {
		return Session{}, false
	}
	return session, true
}

func (s *SessionService) MaxAge() int {
	return int(s.ttl.Seconds())
}

func sessionToken() (string, error) {
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(token), nil
}
