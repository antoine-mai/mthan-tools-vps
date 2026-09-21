package services

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type FileInfo struct {
	Name    string    `json:"name"`
	IsDir   bool      `json:"isDir"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
	Path    string    `json:"path"`
}

type DirectoryList struct {
	CurrentPath string     `json:"currentPath"`
	ParentPath  string     `json:"parentPath"`
	Items       []FileInfo `json:"items"`
}

var ErrAccessDenied = errors.New("access denied")
var ErrInvalidFileOperation = errors.New("invalid file operation")

func CreateFileItem(parentPath, name, homeDir string, isRoot, directory bool) error {
	parentPath, err := allowedFilePath(parentPath, homeDir, isRoot)
	if err != nil {
		return err
	}
	if !isRoot {
		if err := ensureResolvedInHome(parentPath, homeDir); err != nil {
			return err
		}
	}
	if !validFileName(name) {
		return ErrInvalidFileOperation
	}
	target := filepath.Join(parentPath, name)
	if _, err := allowedFilePath(target, homeDir, isRoot); err != nil {
		return err
	}
	if directory {
		if err := os.Mkdir(target, 0755); err != nil {
			return err
		}
		_ = os.Chmod(target, 0755)
		return nil
	}
	file, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return err
	}
	_ = os.Chmod(target, 0644)
	return file.Close()
}

func RenameFileItem(path, name, homeDir string, isRoot bool) (string, error) {
	path, err := mutableFilePath(path, homeDir, isRoot)
	if err != nil {
		return "", err
	}
	if !validFileName(name) {
		return "", ErrInvalidFileOperation
	}
	target := filepath.Join(filepath.Dir(path), name)
	if _, err := allowedFilePath(target, homeDir, isRoot); err != nil {
		return "", err
	}
	if _, err := os.Lstat(target); err == nil {
		return "", os.ErrExist
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	if err := os.Rename(path, target); err != nil {
		return "", err
	}
	return target, nil
}

func DeleteFileItem(path, homeDir string, isRoot bool) error {
	path, err := mutableFilePath(path, homeDir, isRoot)
	if err != nil {
		return err
	}
	return os.RemoveAll(path)
}

func validFileName(name string) bool {
	name = strings.TrimSpace(name)
	return name != "" && name != "." && name != ".." && filepath.Base(name) == name && !strings.ContainsRune(name, 0)
}

func AllowedFilePath(path, homeDir string, isRoot bool) (string, error) {
	return allowedFilePath(path, homeDir, isRoot)
}

func allowedFilePath(path, homeDir string, isRoot bool) (string, error) {
	path = filepath.Clean(path)
	if !filepath.IsAbs(path) {
		return "", ErrAccessDenied
	}
	if !isRoot {
		home := filepath.Clean(homeDir)
		if path != home && !strings.HasPrefix(path, home+string(filepath.Separator)) {
			return "", ErrAccessDenied
		}
	}
	return path, nil
}

func DuplicateFileItem(srcPath, homeDir string, isRoot bool) (string, error) {
	src, err := allowedFilePath(srcPath, homeDir, isRoot)
	if err != nil {
		return "", err
	}
	stat, err := os.Stat(src)
	if err != nil {
		return "", err
	}
	if stat.IsDir() {
		return "", errors.New("cannot duplicate directory")
	}

	dir := filepath.Dir(src)
	base := filepath.Base(src)
	ext := filepath.Ext(base)
	nameWithoutExt := strings.TrimSuffix(base, ext)

	target := filepath.Join(dir, nameWithoutExt+"_copy"+ext)
	for i := 2; ; i++ {
		if _, err := os.Stat(target); errors.Is(err, os.ErrNotExist) {
			break
		}
		target = filepath.Join(dir, fmt.Sprintf("%s_copy_%d%s", nameWithoutExt, i, ext))
	}

	target, err = mutableFilePath(target, homeDir, isRoot)
	if err != nil {
		return "", err
	}

	in, err := os.Open(src)
	if err != nil {
		return "", err
	}
	defer in.Close()

	out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_EXCL, stat.Mode().Perm())
	if err != nil {
		return "", err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return "", err
	}
	return target, nil
}

func mutableFilePath(path, homeDir string, isRoot bool) (string, error) {
	path, err := allowedFilePath(path, homeDir, isRoot)
	if err != nil {
		return "", err
	}
	if path == "/" || (!isRoot && path == filepath.Clean(homeDir)) {
		return "", ErrAccessDenied
	}
	if !isRoot {
		if err := ensureResolvedInHome(path, homeDir); err != nil {
			return "", err
		}
	}
	return path, nil
}

func ensureResolvedInHome(path, homeDir string) error {
	home, err := filepath.EvalSymlinks(filepath.Clean(homeDir))
	if err != nil {
		return err
	}
	resolved, err := filepath.EvalSymlinks(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			parentResolved, parentErr := filepath.EvalSymlinks(filepath.Dir(path))
			if parentErr != nil {
				return parentErr
			}
			if parentResolved != home && !strings.HasPrefix(parentResolved, home+string(filepath.Separator)) {
				return ErrAccessDenied
			}
			return nil
		}
		return err
	}
	if resolved != home && !strings.HasPrefix(resolved, home+string(filepath.Separator)) {
		return ErrAccessDenied
	}
	return nil
}

func SaveFileContent(filePath string, content string, homeDir string, isRoot bool) error {
	path, err := mutableFilePath(filePath, homeDir, isRoot)
	if err != nil {
		return err
	}
	const maxFileSize = 10 * 1024 * 1024 // 10MB limit
	if len(content) > maxFileSize {
		return errors.New("file content exceeds 10MB limit")
	}
	stat, err := os.Stat(path)
	if err == nil {
		if stat.IsDir() {
			return errors.New("cannot write to a directory")
		}
		perm := stat.Mode().Perm()
		if perm == 0 {
			perm = 0644
		}
		return os.WriteFile(path, []byte(content), perm)
	} else if errors.Is(err, os.ErrNotExist) {
		return os.WriteFile(path, []byte(content), 0644)
	}
	return err
}

func ListDirectory(requestedPath string, homeDir string, isRoot bool) (DirectoryList, error) {
	// Clean and resolve path
	var targetPath string
	if requestedPath == "" {
		targetPath = homeDir
	} else {
		targetPath = filepath.Clean(requestedPath)
	}

	// Enforce home directory jail for standard users
	if !isRoot {
		cleanHome := filepath.Clean(homeDir)
		if targetPath != cleanHome && !strings.HasPrefix(targetPath, cleanHome+string(filepath.Separator)) {
			return DirectoryList{}, ErrAccessDenied
		}
	}

	// Read directory
	entries, err := os.ReadDir(targetPath)
	if err != nil {
		return DirectoryList{}, err
	}

	items := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}

		items = append(items, FileInfo{
			Name:    entry.Name(),
			IsDir:   entry.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime(),
			Path:    filepath.Join(targetPath, entry.Name()),
		})
	}

	parentPath := ""
	if targetPath != "/" {
		// For standard users, do not allow going above home directory
		if !isRoot {
			cleanHome := filepath.Clean(homeDir)
			if targetPath != cleanHome {
				parentPath = filepath.Dir(targetPath)
			}
		} else {
			parentPath = filepath.Dir(targetPath)
		}
	}

	return DirectoryList{
		CurrentPath: targetPath,
		ParentPath:  parentPath,
		Items:       items,
	}, nil
}

type FileContent struct {
	Content  string `json:"content"`
	Size     int64  `json:"size"`
	IsBinary bool   `json:"isBinary"`
}

func GetFileContent(filePath string, homeDir string, isRoot bool) (FileContent, error) {
	filePath = filepath.Clean(filePath)

	// Enforce home jail for standard users
	if !isRoot {
		cleanHome := filepath.Clean(homeDir)
		if !strings.HasPrefix(filePath, cleanHome+string(filepath.Separator)) {
			return FileContent{}, ErrAccessDenied
		}
	}

	stat, err := os.Stat(filePath)
	if err != nil {
		return FileContent{}, err
	}
	if stat.IsDir() {
		return FileContent{}, errors.New("cannot read a directory")
	}

	// Check if binary by reading first 512 bytes
	file, err := os.Open(filePath)
	if err != nil {
		return FileContent{}, err
	}
	defer file.Close()

	buffer := make([]byte, 512)
	n, _ := file.Read(buffer)

	isBinary := false
	for i := 0; i < n; i++ {
		if buffer[i] == 0 {
			isBinary = true
			break
		}
	}

	if isBinary {
		return FileContent{
			Size:     stat.Size(),
			IsBinary: true,
		}, nil
	}

	// Read entire file (limit to 2MB)
	data, err := os.ReadFile(filePath)
	if err != nil {
		return FileContent{}, err
	}

	const limit = 2 * 1024 * 1024
	content := string(data)
	if len(content) > limit {
		content = content[:limit] + "\n... [truncated, file too large] ..."
	}

	return FileContent{
		Content:  content,
		Size:     stat.Size(),
		IsBinary: false,
	}, nil
}
