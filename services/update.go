package services

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

const defaultBinaryURL = "https://dist.mthan.net/vps/bin/vps"

var ErrUpdateRequiresRoot = errors.New("self update requires root")

type UpdateResult struct {
	BinaryURL   string    `json:"binaryUrl"`
	InstallPath string    `json:"installPath"`
	Restart     bool      `json:"restart"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type UpdateService struct {
	binaryURL   string
	httpClient  *http.Client
	installPath string
}

func NewUpdateService() *UpdateService {
	return &UpdateService{
		binaryURL:   getEnv("BINARY_URL", defaultBinaryURL),
		httpClient:  &http.Client{Timeout: 60 * time.Second},
		installPath: updateInstallPath(),
	}
}

func (s *UpdateService) SelfUpdate(ctx context.Context) (UpdateResult, error) {
	if os.Geteuid() != 0 {
		return UpdateResult{}, ErrUpdateRequiresRoot
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, s.binaryURL, nil)
	if err != nil {
		return UpdateResult{}, err
	}

	response, err := s.httpClient.Do(request)
	if err != nil {
		return UpdateResult{}, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return UpdateResult{}, errors.New("binary download failed")
	}

	tmpFile, err := os.CreateTemp(filepath.Dir(s.installPath), ".vps-update-*")
	if err != nil {
		return UpdateResult{}, err
	}

	tmpPath := tmpFile.Name()
	removeTmp := true
	defer func() {
		if removeTmp {
			_ = os.Remove(tmpPath)
		}
	}()

	if _, err := io.Copy(tmpFile, response.Body); err != nil {
		_ = tmpFile.Close()
		return UpdateResult{}, err
	}

	if err := tmpFile.Chmod(0755); err != nil {
		_ = tmpFile.Close()
		return UpdateResult{}, err
	}

	if err := tmpFile.Close(); err != nil {
		return UpdateResult{}, err
	}

	if err := os.Rename(tmpPath, s.installPath); err != nil {
		return UpdateResult{}, err
	}
	removeTmp = false

	return UpdateResult{
		BinaryURL:   s.binaryURL,
		InstallPath: s.installPath,
		Restart:     true,
		UpdatedAt:   time.Now(),
	}, nil
}

func updateInstallPath() string {
	if installPath := os.Getenv("INSTALL_PATH"); installPath != "" {
		return installPath
	}

	executable, err := os.Executable()
	if err == nil && executable != "" {
		return executable
	}

	return "/usr/local/bin/vps"
}
