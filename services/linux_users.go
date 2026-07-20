package services

import (
	"bufio"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

var DefaultUserDirectories = []string{"backup", "logs", "data", "htdocs", "config"}

func ProvisionUserHome(home string, uid, gid int) error {
	if err := os.MkdirAll(home, 0755); err != nil {
		return err
	}
	if err := os.Chown(home, uid, gid); err != nil {
		return err
	}

	for _, name := range DefaultUserDirectories {
		directory := filepath.Join(home, name)
		if err := os.MkdirAll(directory, 0755); err != nil {
			return err
		}
		if err := os.Chown(directory, uid, gid); err != nil {
			return err
		}
	}

	return nil
}

type LinuxUser struct {
	CPanelEnabled bool   `json:"cpanelEnabled"`
	HasPassword   bool   `json:"hasPassword"`
	Home          string `json:"home"`
	Name          string `json:"name"`
	Shell         string `json:"shell"`
	UID           int    `json:"uid"`
	Username      string `json:"username"`
}

func UserApps(home string) ([]string, error) {
	entries, err := os.ReadDir(filepath.Join(home, "htdocs"))
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}

	apps := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			apps = append(apps, entry.Name())
		}
	}
	return apps, nil
}

func HomeUser(username string) (LinuxUser, bool, error) {
	users, err := HomeUsers()
	if err != nil {
		return LinuxUser{}, false, err
	}
	for _, linuxUser := range users {
		if linuxUser.Username == username {
			return linuxUser, true, nil
		}
	}
	return LinuxUser{}, false, nil
}

func HomeUsers() ([]LinuxUser, error) {
	return homeUsersIn("/home", passwdUsersByName())
}

func HomeUsersWithAccess() ([]LinuxUser, error) {
	users, err := HomeUsers()
	if err != nil {
		return nil, err
	}
	return userAccessFromShadow(users, "/etc/shadow")
}

func userAccessFromShadow(users []LinuxUser, shadowPath string) ([]LinuxUser, error) {
	file, err := os.Open(shadowPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	hashes := make(map[string]string)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		parts := strings.SplitN(scanner.Text(), ":", 3)
		if len(parts) >= 2 {
			hashes[parts[0]] = parts[1]
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	for index := range users {
		users[index].HasPassword, users[index].CPanelEnabled = passwordAccessState(hashes[users[index].Username])
	}
	return users, nil
}

func passwordAccessState(hash string) (bool, bool) {
	locked := strings.HasPrefix(hash, "!") || strings.HasPrefix(hash, "*")
	usableHash := strings.TrimLeft(hash, "!")
	hasPassword := usableHash != "" && usableHash != "*"
	return hasPassword, hasPassword && !locked
}

func homeUsersIn(homeRoot string, passwdUsers map[string]passwdUser) ([]LinuxUser, error) {
	entries, err := os.ReadDir(homeRoot)
	if err != nil {
		if os.IsNotExist(err) {
			return []LinuxUser{}, nil
		}
		return nil, err
	}

	users := make([]LinuxUser, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		name := entry.Name()
		home := filepath.Join(homeRoot, name)
		linuxUser := LinuxUser{
			Home:     home,
			Name:     name,
			Shell:    passwdUsers[name].Shell,
			UID:      -1,
			Username: name,
		}

		if passwdUsers[name].Username != "" {
			linuxUser.Username = passwdUsers[name].Username
			linuxUser.UID = passwdUsers[name].UID
		}

		users = append(users, linuxUser)
	}

	return users, nil
}

type passwdUser struct {
	Shell    string
	UID      int
	Username string
}

func passwdUsersByName() map[string]passwdUser {
	file, err := os.Open("/etc/passwd")
	if err != nil {
		return map[string]passwdUser{}
	}
	defer file.Close()

	users := make(map[string]passwdUser)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		parts := strings.Split(scanner.Text(), ":")
		if len(parts) < 7 {
			continue
		}

		uid, _ := strconv.Atoi(parts[2])
		users[parts[0]] = passwdUser{
			Shell:    parts[6],
			UID:      uid,
			Username: parts[0],
		}
	}

	return users
}
