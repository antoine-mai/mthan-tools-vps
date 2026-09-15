package services

import (
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

type UserOverview struct {
	Username   string                 `json:"username"`
	Home       string                 `json:"home"`
	Containers UserContainersOverview `json:"containers"`
	VHosts     UserVHostsOverview     `json:"vhosts"`
	Storage    UserStorageOverview    `json:"storage"`
}

type UserContainersOverview struct {
	Total   int         `json:"total"`
	Running int         `json:"running"`
	Stopped int         `json:"stopped"`
	Items   []Container `json:"items"`
}

type UserVHostsOverview struct {
	Total int            `json:"total"`
	Items []VHostSummary `json:"items"`
}

type UserStorageOverview struct {
	HomePath  string            `json:"homePath"`
	HomeUsed  uint64            `json:"homeUsed"`
	DiskTotal uint64            `json:"diskTotal"`
	DiskUsed  uint64            `json:"diskUsed"`
	DiskUsage float64           `json:"diskUsage"`
	Breakdown map[string]uint64 `json:"breakdown,omitempty"`
}

func GetUserOverview(username string) UserOverview {
	username = strings.TrimSpace(username)
	homeDir := "/home/" + username
	if username == "root" {
		homeDir = "/root"
	}
	if user, found, _ := HomeUser(username); found && user.Home != "" {
		homeDir = user.Home
	}

	// 1. Containers
	containerService := NewContainerService()
	allContainers := containerService.ListAll()
	userContainers := make([]Container, 0)
	running, stopped := 0, 0
	for _, c := range allContainers {
		if strings.EqualFold(c.Owner, username) {
			userContainers = append(userContainers, c)
			if c.Status == "running" {
				running++
			} else {
				stopped++
			}
		}
	}

	// 2. VHosts
	vhostService := NewVHostService()
	userVHosts := vhostService.SummariesForOwner(username)

	// 3. Storage
	homeUsed := UserHomeSize(homeDir)
	breakdown := make(map[string]uint64)
	for _, dirName := range DefaultUserDirectories {
		subPath := filepath.Join(homeDir, dirName)
		if stat, err := os.Stat(subPath); err == nil && stat.IsDir() {
			breakdown[dirName] = UserHomeSize(subPath)
		}
	}

	var diskTotal, diskUsed uint64
	var diskUsage float64
	var stat syscall.Statfs_t
	targetStatPath := homeDir
	if _, err := os.Stat(targetStatPath); err != nil {
		targetStatPath = "/"
	}
	if err := syscall.Statfs(targetStatPath, &stat); err == nil {
		diskTotal = stat.Blocks * uint64(stat.Bsize)
		available := stat.Bavail * uint64(stat.Bsize)
		diskUsed = diskTotal - available
		if diskTotal > 0 {
			diskUsage = float64(diskUsed) / float64(diskTotal) * 100
		}
	}

	return UserOverview{
		Username: username,
		Home:     homeDir,
		Containers: UserContainersOverview{
			Total:   len(userContainers),
			Running: running,
			Stopped: stopped,
			Items:   userContainers,
		},
		VHosts: UserVHostsOverview{
			Total: len(userVHosts),
			Items: userVHosts,
		},
		Storage: UserStorageOverview{
			HomePath:  homeDir,
			HomeUsed:  homeUsed,
			DiskTotal: diskTotal,
			DiskUsed:  diskUsed,
			DiskUsage: diskUsage,
			Breakdown: breakdown,
		},
	}
}

func UserHomeSize(path string) uint64 {
	if path == "" {
		return 0
	}
	cmd := exec.Command("du", "-sb", path)
	out, err := cmd.Output()
	if err == nil {
		fields := strings.Fields(string(out))
		if len(fields) > 0 {
			if size, err := strconv.ParseUint(fields[0], 10, 64); err == nil {
				return size
			}
		}
	}
	var total uint64
	_ = filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			total += uint64(info.Size())
		}
		return nil
	})
	return total
}
