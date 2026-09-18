package services

import (
	"encoding/json"
	"fmt"
	"strings"
)

type LibraryTemplate struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	Image          string          `json:"image"`
	Category       string          `json:"category"`
	Description    string          `json:"description"`
	DefaultPorts   []PortMapping   `json:"defaultPorts,omitempty"`
	DefaultEnv     []EnvMapping    `json:"defaultEnv,omitempty"`
	DefaultVolumes []VolumeMapping `json:"defaultVolumes,omitempty"`
	Tags           []string        `json:"tags"`
	Enabled        bool            `json:"enabled"`
	IsCustom       bool            `json:"isCustom,omitempty"`
}

type PortMapping struct {
	Host      string `json:"host"`
	Container string `json:"container"`
}

type EnvMapping struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type VolumeMapping struct {
	Host      string `json:"host"`
	Container string `json:"container"`
}

type ContainerTemplatesSettings struct {
	Templates   []LibraryTemplate `json:"templates"`
	LibraryOnly bool              `json:"libraryOnly"`
}

const (
	settingsKeyContainerTemplates   = "containers_library_templates"
	settingsKeyContainerLibraryOnly = "containers_policy_library_only"
)

func DefaultLibraryTemplates() []LibraryTemplate {
	return []LibraryTemplate{
		// ── Automation & Workflows ──
		{
			ID:          "n8n",
			Name:        "n8n",
			Image:       "n8nio/n8n:latest",
			Category:    "automation",
			Description: "Extensible workflow automation platform with AI agent nodes and 400+ integrations.",
			DefaultPorts: []PortMapping{
				{Host: "5678", Container: "5678"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "n8n_data", Container: "/home/node/.n8n"},
			},
			DefaultEnv: []EnvMapping{
				{Key: "GENERIC_TIMEZONE", Value: "Asia/Ho_Chi_Minh"},
				{Key: "TZ", Value: "Asia/Ho_Chi_Minh"},
			},
			Tags:    []string{"latest", "next"},
			Enabled: true,
		},
		{
			ID:          "flowise",
			Name:        "Flowise",
			Image:       "flowiseai/flowise:latest",
			Category:    "automation",
			Description: "Drag-and-drop UI to build customized LLM orchestration flows, chains, and AI agents.",
			DefaultPorts: []PortMapping{
				{Host: "3000", Container: "3000"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "flowise_data", Container: "/root/.flowise"},
			},
			Tags:    []string{"latest"},
			Enabled: true,
		},
		{
			ID:          "activepieces",
			Name:        "Activepieces",
			Image:       "activepieces/activepieces:latest",
			Category:    "automation",
			Description: "Open-source no-code business automation tool, self-hosted Zapier alternative.",
			DefaultPorts: []PortMapping{
				{Host: "8080", Container: "80"},
			},
			Tags:    []string{"latest"},
			Enabled: true,
		},
		{
			ID:          "pocketbase",
			Name:        "PocketBase",
			Image:       "muchobien/pocketbase:latest",
			Category:    "automation",
			Description: "Open-source realtime backend in 1 file with embedded SQLite database and auth.",
			DefaultPorts: []PortMapping{
				{Host: "8090", Container: "8090"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "pb_data", Container: "/pb/pb_data"},
			},
			Tags:    []string{"latest"},
			Enabled: true,
		},
		{
			ID:          "directus",
			Name:        "Directus",
			Image:       "directus/directus:latest",
			Category:    "automation",
			Description: "Composable data engine, instant REST/GraphQL API, and intuitive headless CMS.",
			DefaultPorts: []PortMapping{
				{Host: "8055", Container: "8055"},
			},
			Tags:    []string{"latest"},
			Enabled: true,
		},

		// ── AI & LLM ──
		{
			ID:          "ollama",
			Name:        "Ollama",
			Image:       "ollama/ollama:latest",
			Category:    "ai",
			Description: "Run Llama 3, Mistral, Gemma, Phi, and other open-source LLMs locally.",
			DefaultPorts: []PortMapping{
				{Host: "11434", Container: "11434"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "ollama", Container: "/root/.ollama"},
			},
			Tags:    []string{"latest"},
			Enabled: true,
		},
		{
			ID:          "open-webui",
			Name:        "Open WebUI",
			Image:       "ghcr.io/open-webui/open-webui:main",
			Category:    "ai",
			Description: "Feature-rich, user-friendly ChatGPT-like web interface for Ollama and local LLMs.",
			DefaultPorts: []PortMapping{
				{Host: "3000", Container: "8080"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "open-webui", Container: "/app/backend/data"},
			},
			DefaultEnv: []EnvMapping{
				{Key: "OLLAMA_BASE_URL", Value: "http://host.containers.internal:11434"},
			},
			Tags:    []string{"main", "latest", "cuda"},
			Enabled: true,
		},
		{
			ID:          "localai",
			Name:        "LocalAI",
			Image:       "localai/localai:latest",
			Category:    "ai",
			Description: "Self-hosted, drop-in replacement REST API compatible with OpenAI specifications.",
			DefaultPorts: []PortMapping{
				{Host: "8080", Container: "8080"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "localai-models", Container: "/build/models"},
			},
			Tags:    []string{"latest"},
			Enabled: true,
		},
		{
			ID:          "qdrant",
			Name:        "Qdrant",
			Image:       "qdrant/qdrant:latest",
			Category:    "ai",
			Description: "High-performance vector database & search engine for AI embeddings and RAG.",
			DefaultPorts: []PortMapping{
				{Host: "6333", Container: "6333"},
				{Host: "6334", Container: "6334"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "qdrant_storage", Container: "/qdrant/storage"},
			},
			Tags:    []string{"latest"},
			Enabled: true,
		},
		{
			ID:          "chroma",
			Name:        "ChromaDB",
			Image:       "chromadb/chroma:latest",
			Category:    "ai",
			Description: "Open-source embedding database for AI application memory and search.",
			DefaultPorts: []PortMapping{
				{Host: "8000", Container: "8000"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "chroma_data", Container: "/chroma/chroma"},
			},
			Tags:    []string{"latest"},
			Enabled: true,
		},
		{
			ID:          "vllm",
			Name:        "vLLM",
			Image:       "vllm/vllm-openai:latest",
			Category:    "ai",
			Description: "High-throughput, low-latency LLM serving engine with OpenAI-compatible API.",
			DefaultPorts: []PortMapping{
				{Host: "8000", Container: "8000"},
			},
			Tags:    []string{"latest"},
			Enabled: true,
		},

		// ── Runtimes ──
		{
			ID:          "node",
			Name:        "Node.js",
			Image:       "node:20-alpine",
			Category:    "runtime",
			Description: "JavaScript runtime built on Chrome's V8 engine for building fast web apps and APIs.",
			DefaultPorts: []PortMapping{
				{Host: "3000", Container: "3000"},
			},
			Tags:    []string{"20-alpine", "22-alpine", "latest", "lts-alpine"},
			Enabled: true,
		},
		{
			ID:          "python",
			Name:        "Python",
			Image:       "python:3.12-alpine",
			Category:    "runtime",
			Description: "Modern Python programming language runtime with pip and virtual environment support.",
			DefaultPorts: []PortMapping{
				{Host: "8000", Container: "8000"},
			},
			Tags:    []string{"3.12-alpine", "3.11-alpine", "latest"},
			Enabled: true,
		},
		{
			ID:          "bun",
			Name:        "Bun",
			Image:       "oven/bun:alpine",
			Category:    "runtime",
			Description: "Incredibly fast all-in-one JavaScript & TypeScript runtime, bundler, and package manager.",
			DefaultPorts: []PortMapping{
				{Host: "3000", Container: "3000"},
			},
			Tags:    []string{"alpine", "latest", "debian"},
			Enabled: true,
		},
		{
			ID:          "golang",
			Name:        "Golang",
			Image:       "golang:1.22-alpine",
			Category:    "runtime",
			Description: "Official Go compiler and runtime environment for building fast, concurrent systems.",
			Tags:        []string{"1.22-alpine", "1.23-alpine", "latest"},
			Enabled:     true,
		},
		{
			ID:          "deno",
			Name:        "Deno",
			Image:       "denoland/deno:alpine",
			Category:    "runtime",
			Description: "Next-generation secure JavaScript, TypeScript, and WebAssembly runtime.",
			DefaultPorts: []PortMapping{
				{Host: "8000", Container: "8000"},
			},
			Tags:    []string{"alpine", "latest"},
			Enabled: true,
		},
		{
			ID:          "php",
			Name:        "PHP FPM",
			Image:       "php:8.3-fpm-alpine",
			Category:    "runtime",
			Description: "FastCGI Process Manager implementation for PHP web applications.",
			DefaultPorts: []PortMapping{
				{Host: "9000", Container: "9000"},
			},
			Tags:    []string{"8.3-fpm-alpine", "8.2-fpm-alpine", "latest"},
			Enabled: true,
		},
		{
			ID:          "rust",
			Name:        "Rust",
			Image:       "rust:alpine",
			Category:    "runtime",
			Description: "Official Rust programming language compiler and Cargo toolchain.",
			Tags:        []string{"alpine", "latest"},
			Enabled:     true,
		},

		// ── Databases ──
		{
			ID:          "postgres",
			Name:        "PostgreSQL",
			Image:       "postgres:16-alpine",
			Category:    "database",
			Description: "World's most advanced open source relational database.",
			DefaultPorts: []PortMapping{
				{Host: "5432", Container: "5432"},
			},
			DefaultEnv: []EnvMapping{
				{Key: "POSTGRES_PASSWORD", Value: ""},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "postgres_data", Container: "/var/lib/postgresql/data"},
			},
			Tags:    []string{"16-alpine", "15-alpine", "latest"},
			Enabled: true,
		},
		{
			ID:          "mysql",
			Name:        "MySQL",
			Image:       "mysql:8",
			Category:    "database",
			Description: "Widely used open source relational database management system.",
			DefaultPorts: []PortMapping{
				{Host: "3306", Container: "3306"},
			},
			DefaultEnv: []EnvMapping{
				{Key: "MYSQL_ROOT_PASSWORD", Value: ""},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "mysql_data", Container: "/var/lib/mysql"},
			},
			Tags:    []string{"8", "8.4", "latest"},
			Enabled: true,
		},
		{
			ID:          "mariadb",
			Name:        "MariaDB",
			Image:       "mariadb:11",
			Category:    "database",
			Description: "Fast, scalable open source relational database made by MySQL original creators.",
			DefaultPorts: []PortMapping{
				{Host: "3306", Container: "3306"},
			},
			DefaultEnv: []EnvMapping{
				{Key: "MARIADB_ROOT_PASSWORD", Value: ""},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "mariadb_data", Container: "/var/lib/mysql"},
			},
			Tags:    []string{"11", "latest"},
			Enabled: true,
		},
		{
			ID:          "mongo",
			Name:        "MongoDB",
			Image:       "mongo:7",
			Category:    "database",
			Description: "Modern, document-oriented NoSQL general purpose database.",
			DefaultPorts: []PortMapping{
				{Host: "27017", Container: "27017"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "mongo_data", Container: "/data/db"},
			},
			Tags:    []string{"7", "6", "latest"},
			Enabled: true,
		},

		// ── Cache & Queue ──
		{
			ID:          "redis",
			Name:        "Redis",
			Image:       "redis:alpine",
			Category:    "cache",
			Description: "In-memory key-value data store, cache, and message broker.",
			DefaultPorts: []PortMapping{
				{Host: "6379", Container: "6379"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "redis_data", Container: "/data"},
			},
			Tags:    []string{"alpine", "7-alpine", "latest"},
			Enabled: true,
		},
		{
			ID:          "rabbitmq",
			Name:        "RabbitMQ",
			Image:       "rabbitmq:3-management-alpine",
			Category:    "cache",
			Description: "Robust open source message broker with web management interface.",
			DefaultPorts: []PortMapping{
				{Host: "5672", Container: "5672"},
				{Host: "15672", Container: "15672"},
			},
			Tags:    []string{"3-management-alpine", "latest"},
			Enabled: true,
		},
		{
			ID:          "memcached",
			Name:        "Memcached",
			Image:       "memcached:alpine",
			Category:    "cache",
			Description: "High-performance, distributed memory object caching system.",
			DefaultPorts: []PortMapping{
				{Host: "11211", Container: "11211"},
			},
			Tags:    []string{"alpine", "latest"},
			Enabled: true,
		},

		// ── Dev Tools ──
		{
			ID:          "adminer",
			Name:        "Adminer",
			Image:       "adminer:latest",
			Category:    "tools",
			Description: "Database management in a single PHP file supporting MySQL, Postgres, SQLite.",
			DefaultPorts: []PortMapping{
				{Host: "8080", Container: "8080"},
			},
			Tags:    []string{"latest"},
			Enabled: true,
		},
		{
			ID:          "meilisearch",
			Name:        "Meilisearch",
			Image:       "getmeili/meilisearch:v1.7",
			Category:    "tools",
			Description: "Lightning-fast, typo-tolerant search engine with intuitive REST APIs.",
			DefaultPorts: []PortMapping{
				{Host: "7700", Container: "7700"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "meili_data", Container: "/meili_data"},
			},
			Tags:    []string{"v1.7", "latest"},
			Enabled: true,
		},
		{
			ID:          "minio",
			Name:        "MinIO",
			Image:       "minio/minio:latest",
			Category:    "tools",
			Description: "High-performance, S3-compatible cloud object storage service.",
			DefaultPorts: []PortMapping{
				{Host: "9000", Container: "9000"},
				{Host: "9001", Container: "9001"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "minio_data", Container: "/data"},
			},
			DefaultEnv: []EnvMapping{
				{Key: "MINIO_ROOT_USER", Value: "admin"},
				{Key: "MINIO_ROOT_PASSWORD", Value: "password123"},
			},
			Tags:    []string{"latest"},
			Enabled: true,
		},
		{
			ID:          "uptime-kuma",
			Name:        "Uptime Kuma",
			Image:       "louislam/uptime-kuma:1",
			Category:    "tools",
			Description: "Self-hosted monitoring tool for HTTP, TCP, Ping, and service uptime.",
			DefaultPorts: []PortMapping{
				{Host: "3001", Container: "3001"},
			},
			DefaultVolumes: []VolumeMapping{
				{Host: "uptime_kuma", Container: "/app/data"},
			},
			Tags:    []string{"1", "latest"},
			Enabled: true,
		},
		{
			ID:          "alpine",
			Name:        "Alpine Linux",
			Image:       "alpine:latest",
			Category:    "tools",
			Description: "Lightweight, security-oriented Linux distribution (~5MB).",
			Tags:        []string{"latest", "3.20"},
			Enabled:     true,
		},
		{
			ID:          "ubuntu",
			Name:        "Ubuntu",
			Image:       "ubuntu:latest",
			Category:    "tools",
			Description: "Clean Ubuntu Linux official base container environment.",
			Tags:        []string{"latest", "24.04", "22.04"},
			Enabled:     true,
		},
	}
}

func GetContainerTemplatesSettings(settings *SettingsService) (ContainerTemplatesSettings, error) {
	raw := settings.Get(settingsKeyContainerTemplates, "")
	libraryOnly := settings.Get(settingsKeyContainerLibraryOnly, "false") == "true"

	if strings.TrimSpace(raw) == "" {
		return ContainerTemplatesSettings{
			Templates:   DefaultLibraryTemplates(),
			LibraryOnly: libraryOnly,
		}, nil
	}

	var templates []LibraryTemplate
	if err := json.Unmarshal([]byte(raw), &templates); err != nil {
		return ContainerTemplatesSettings{
			Templates:   DefaultLibraryTemplates(),
			LibraryOnly: libraryOnly,
		}, nil
	}

	return ContainerTemplatesSettings{
		Templates:   templates,
		LibraryOnly: libraryOnly,
	}, nil
}

func SaveContainerTemplatesSettings(settings *SettingsService, cfg ContainerTemplatesSettings) error {
	raw, err := json.Marshal(cfg.Templates)
	if err != nil {
		return err
	}
	if err := settings.Set(settingsKeyContainerTemplates, string(raw)); err != nil {
		return err
	}
	return settings.Set(settingsKeyContainerLibraryOnly, fmt.Sprintf("%t", cfg.LibraryOnly))
}

func ResetContainerTemplates(settings *SettingsService) error {
	defaults := DefaultLibraryTemplates()
	raw, err := json.Marshal(defaults)
	if err != nil {
		return err
	}
	if err := settings.Set(settingsKeyContainerTemplates, string(raw)); err != nil {
		return err
	}
	return settings.Set(settingsKeyContainerLibraryOnly, "false")
}

func IsImageAllowed(settings *SettingsService, requestedImage string) bool {
	cfg, err := GetContainerTemplatesSettings(settings)
	if err != nil {
		return true
	}
	if !cfg.LibraryOnly {
		return true
	}

	requested := strings.TrimSpace(requestedImage)
	if requested == "" {
		return false
	}
	reqBase := strings.Split(requested, ":")[0]

	for _, t := range cfg.Templates {
		if !t.Enabled {
			continue
		}
		if t.Image == requested {
			return true
		}
		tBase := strings.Split(t.Image, ":")[0]
		if tBase == reqBase {
			return true
		}
		for _, tag := range t.Tags {
			if fmt.Sprintf("%s:%s", tBase, tag) == requested {
				return true
			}
		}
	}
	return false
}
