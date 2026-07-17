package services

import (
	"archive/zip"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

var appDirectoryPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$`)

func CloneUserApp(home, name, repository string, uid, gid int) error {
	destination, err := newUserAppDestination(home, name)
	if err != nil {
		return err
	}
	if !(strings.HasPrefix(repository, "https://") || strings.HasPrefix(repository, "http://") || strings.HasPrefix(repository, "ssh://") || strings.HasPrefix(repository, "git@")) {
		return errors.New("unsupported repository URL")
	}
	if output, err := exec.Command("git", "clone", "--depth", "1", "--", repository, destination).CombinedOutput(); err != nil {
		return errors.New(strings.TrimSpace(string(output)))
	}
	return chownTree(destination, uid, gid)
}

func UploadUserAppZIP(home, name string, archive *zip.Reader, uid, gid int) error {
	destination, err := newUserAppDestination(home, name)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(destination, 0755); err != nil {
		return err
	}
	failed := true
	defer func() {
		if failed {
			_ = os.RemoveAll(destination)
		}
	}()
	for _, file := range archive.File {
		target := filepath.Join(destination, filepath.Clean(file.Name))
		if target != destination && !strings.HasPrefix(target, destination+string(os.PathSeparator)) {
			return errors.New("invalid ZIP path")
		}
		if file.Mode()&os.ModeSymlink != 0 {
			return errors.New("ZIP symlinks are not allowed")
		}
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}
		source, err := file.Open()
		if err != nil {
			return err
		}
		dest, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, file.Mode().Perm())
		if err != nil {
			source.Close()
			return err
		}
		_, copyErr := io.Copy(dest, io.LimitReader(source, 256<<20))
		source.Close()
		dest.Close()
		if copyErr != nil {
			return copyErr
		}
	}
	if err := chownTree(destination, uid, gid); err != nil {
		return err
	}
	failed = false
	return nil
}

func newUserAppDestination(home, name string) (string, error) {
	if !appDirectoryPattern.MatchString(name) {
		return "", errors.New("invalid app name")
	}
	destination := filepath.Join(home, "htdocs", name)
	if _, err := os.Stat(destination); err == nil {
		return "", errors.New("app already exists")
	} else if !os.IsNotExist(err) {
		return "", err
	}
	return destination, nil
}

func chownTree(root string, uid, gid int) error {
	return filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		return os.Chown(path, uid, gid)
	})
}
