//go:build !linux || !cgo

package services

func verifyPasswordHash(password string, hash string) (bool, error) {
	return false, ErrAuthUnavailable
}
