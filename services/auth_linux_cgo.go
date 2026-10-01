//go:build linux && cgo

package services

/*
#cgo LDFLAGS: -lcrypt
#include <stdlib.h>
extern char *crypt(const char *key, const char *salt);
*/
import "C"

import (
	"crypto/subtle"
	"sync"
	"unsafe"
)

var cryptMu sync.Mutex

func verifyPasswordHash(password string, hash string) (bool, error) {
	cPassword := C.CString(password)
	defer C.free(unsafe.Pointer(cPassword))

	cHash := C.CString(hash)
	defer C.free(unsafe.Pointer(cHash))

	cryptMu.Lock()
	result := C.crypt(cPassword, cHash)
	var computed string
	if result != nil {
		computed = C.GoString(result)
	}
	cryptMu.Unlock()

	if computed == "" {
		return false, ErrAuthUnavailable
	}

	return subtle.ConstantTimeCompare([]byte(computed), []byte(hash)) == 1, nil
}
