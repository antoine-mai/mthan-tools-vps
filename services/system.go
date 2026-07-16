package services

import (
	"bufio"
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type SystemStatus struct {
	CPU     CPUStatus     `json:"cpu"`
	Memory  MemoryStatus  `json:"memory"`
	Storage StorageStatus `json:"storage"`
	Network NetworkStatus `json:"network"`
}

type CPUStatus struct {
	Cores int     `json:"cores"`
	Model string  `json:"model"`
	Usage float64 `json:"usage"`
}

type MemoryStatus struct {
	Total uint64  `json:"total"`
	Used  uint64  `json:"used"`
	Usage float64 `json:"usage"`
}

type StorageStatus struct {
	Total uint64  `json:"total"`
	Used  uint64  `json:"used"`
	Usage float64 `json:"usage"`
}

type NetworkStatus struct {
	Received uint64 `json:"received"`
	Sent     uint64 `json:"sent"`
}

type SystemService struct{}

func NewSystemService() *SystemService { return &SystemService{} }

func (s *SystemService) Status() (SystemStatus, error) {
	cpu, err := cpuStatus()
	if err != nil {
		return SystemStatus{}, err
	}
	memory, err := memoryStatus()
	if err != nil {
		return SystemStatus{}, err
	}
	storage, err := storageStatus("/")
	if err != nil {
		return SystemStatus{}, err
	}
	network, err := networkStatus()
	if err != nil {
		return SystemStatus{}, err
	}

	return SystemStatus{CPU: cpu, Memory: memory, Storage: storage, Network: network}, nil
}

func cpuStatus() (CPUStatus, error) {
	idleBefore, totalBefore, err := cpuTimes()
	if err != nil {
		return CPUStatus{}, err
	}
	time.Sleep(100 * time.Millisecond)
	idleAfter, totalAfter, err := cpuTimes()
	if err != nil {
		return CPUStatus{}, err
	}

	usage := 0.0
	totalDelta := totalAfter - totalBefore
	if totalDelta > 0 {
		usage = float64(totalDelta-(idleAfter-idleBefore)) / float64(totalDelta) * 100
	}

	return CPUStatus{Cores: runtime.NumCPU(), Model: cpuModel(), Usage: usage}, nil
}

func cpuTimes() (idle, total uint64, err error) {
	file, err := os.Open("/proc/stat")
	if err != nil {
		return 0, 0, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		return 0, 0, fmt.Errorf("could not read CPU statistics")
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 5 || fields[0] != "cpu" {
		return 0, 0, fmt.Errorf("invalid CPU statistics")
	}
	for index, field := range fields[1:] {
		value, parseErr := strconv.ParseUint(field, 10, 64)
		if parseErr != nil {
			return 0, 0, parseErr
		}
		total += value
		if index == 3 || index == 4 {
			idle += value
		}
	}
	return idle, total, nil
}

func cpuModel() string {
	file, err := os.Open("/proc/cpuinfo")
	if err != nil {
		return "CPU"
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		key, value, ok := strings.Cut(scanner.Text(), ":")
		if ok && (strings.TrimSpace(key) == "model name" || strings.TrimSpace(key) == "Hardware") {
			return strings.TrimSpace(value)
		}
	}
	return "CPU"
}

func memoryStatus() (MemoryStatus, error) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return MemoryStatus{}, err
	}
	values := make(map[string]uint64)
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		value, parseErr := strconv.ParseUint(fields[1], 10, 64)
		if parseErr == nil {
			values[strings.TrimSuffix(fields[0], ":")] = value * 1024
		}
	}
	total := values["MemTotal"]
	available := values["MemAvailable"]
	if total == 0 {
		return MemoryStatus{}, fmt.Errorf("memory total is unavailable")
	}
	used := total - available
	return MemoryStatus{Total: total, Used: used, Usage: float64(used) / float64(total) * 100}, nil
}

func storageStatus(path string) (StorageStatus, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return StorageStatus{}, err
	}
	total := stat.Blocks * uint64(stat.Bsize)
	available := stat.Bavail * uint64(stat.Bsize)
	used := total - available
	usage := 0.0
	if total > 0 {
		usage = float64(used) / float64(total) * 100
	}
	return StorageStatus{Total: total, Used: used, Usage: usage}, nil
}

func networkStatus() (NetworkStatus, error) {
	file, err := os.Open("/proc/net/dev")
	if err != nil {
		return NetworkStatus{}, err
	}
	defer file.Close()

	var status NetworkStatus
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		name, values, ok := strings.Cut(line, ":")
		if !ok || strings.TrimSpace(name) == "lo" {
			continue
		}
		fields := strings.Fields(values)
		if len(fields) < 9 {
			continue
		}
		received, receiveErr := strconv.ParseUint(fields[0], 10, 64)
		sent, sentErr := strconv.ParseUint(fields[8], 10, 64)
		if receiveErr == nil && sentErr == nil {
			status.Received += received
			status.Sent += sent
		}
	}
	return status, scanner.Err()
}
