package services

import (
	"errors"
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
