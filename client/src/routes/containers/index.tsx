import { useCallback, useEffect, useState } from "react";
import {
    Box,
    Container as ContainerIcon,
    FileCode2,
    FileText,
    Layers,
    Loader2,
    Play,
    Plus,
    RefreshCw,
    RotateCw,
    Save,
    Search,
    Square,
    Trash2,
    Wrench,
    X,
} from "lucide-react";

import DashboardLayout from "_layouts/dashboard";
import { Button } from "_layouts/_components/ui/button";
import Api from "_utils/api";
import { runtime } from "../../runtime";

type ContainerRecord = {
    id: string;
    name: string;
    image: string;
    command?: string;
    engine: "podman" | string;
    owner: string;
    state: string;
    status: string;
    createdAt?: string;
    ports: string[];
};

type LinuxUser = {
    username: string;
    uid?: number;
};

type LibraryImage = {
    id: string;
    name: string;
    image: string;
    category: "ai" | "automation" | "runtime" | "database" | "cache" | "tools";
    description: string;
    defaultPorts?: Array<{ host: string; container: string }>;
    defaultEnv?: Array<{ key: string; value: string }>;
    defaultVolumes?: Array<{ host: string; container: string }>;
    tags: string[];
};

const LIB_CATEGORIES = [
    { id: "all", label: "All" },
    { id: "automation", label: "Automation" },
    { id: "ai", label: "AI & LLM" },
    { id: "runtime", label: "Runtimes" },
    { id: "database", label: "Databases" },
    { id: "cache", label: "Cache & Queue" },
    { id: "tools", label: "Dev Tools" },
];

const LIBRARY_IMAGES: LibraryImage[] = [
    // ── Automation & Workflows ──
    {
        id: "n8n",
        name: "n8n",
        image: "n8nio/n8n:latest",
        category: "automation",
        description: "Extensible workflow automation platform with AI agent nodes and 400+ integrations.",
        defaultPorts: [{ host: "5678", container: "5678" }],
        defaultVolumes: [{ host: "n8n_data", container: "/home/node/.n8n" }],
        defaultEnv: [
            { key: "GENERIC_TIMEZONE", value: "Asia/Ho_Chi_Minh" },
            { key: "TZ", value: "Asia/Ho_Chi_Minh" },
        ],
        tags: ["latest", "next"],
    },
    {
        id: "flowise",
        name: "Flowise",
        image: "flowiseai/flowise:latest",
        category: "automation",
        description: "Drag-and-drop UI to build customized LLM orchestration flows, chains, and AI agents.",
        defaultPorts: [{ host: "3000", container: "3000" }],
        defaultVolumes: [{ host: "flowise_data", container: "/root/.flowise" }],
        tags: ["latest"],
    },
    {
        id: "activepieces",
        name: "Activepieces",
        image: "activepieces/activepieces:latest",
        category: "automation",
        description: "Open-source no-code business automation tool, self-hosted Zapier alternative.",
        defaultPorts: [{ host: "8080", container: "80" }],
        tags: ["latest"],
    },
    {
        id: "pocketbase",
        name: "PocketBase",
        image: "muchobien/pocketbase:latest",
        category: "automation",
        description: "Open-source realtime backend in 1 file with embedded SQLite database and auth.",
        defaultPorts: [{ host: "8090", container: "8090" }],
        defaultVolumes: [{ host: "pb_data", container: "/pb/pb_data" }],
        tags: ["latest"],
    },
    {
        id: "directus",
        name: "Directus",
        image: "directus/directus:latest",
        category: "automation",
        description: "Composable data engine, instant REST/GraphQL API, and intuitive headless CMS.",
        defaultPorts: [{ host: "8055", container: "8055" }],
        tags: ["latest"],
    },

    // ── AI & LLM ──
    {
        id: "ollama",
        name: "Ollama",
        image: "ollama/ollama:latest",
        category: "ai",
        description: "Run Llama 3, Mistral, Gemma, Phi, and other open-source LLMs locally.",
        defaultPorts: [{ host: "11434", container: "11434" }],
        defaultVolumes: [{ host: "ollama", container: "/root/.ollama" }],
        tags: ["latest"],
    },
    {
        id: "open-webui",
        name: "Open WebUI",
        image: "ghcr.io/open-webui/open-webui:main",
        category: "ai",
        description: "Feature-rich, user-friendly ChatGPT-like web interface for Ollama and local LLMs.",
        defaultPorts: [{ host: "3000", container: "8080" }],
        defaultVolumes: [{ host: "open-webui", container: "/app/backend/data" }],
        defaultEnv: [{ key: "OLLAMA_BASE_URL", value: "http://host.containers.internal:11434" }],
        tags: ["main", "latest", "cuda"],
    },
    {
        id: "localai",
        name: "LocalAI",
        image: "localai/localai:latest",
        category: "ai",
        description: "Self-hosted, drop-in replacement REST API compatible with OpenAI specifications.",
        defaultPorts: [{ host: "8080", container: "8080" }],
        defaultVolumes: [{ host: "localai-models", container: "/build/models" }],
        tags: ["latest"],
    },
    {
        id: "qdrant",
        name: "Qdrant",
        image: "qdrant/qdrant:latest",
        category: "ai",
        description: "High-performance vector database & search engine for AI embeddings and RAG.",
        defaultPorts: [
            { host: "6333", container: "6333" },
            { host: "6334", container: "6334" },
        ],
        defaultVolumes: [{ host: "qdrant_storage", container: "/qdrant/storage" }],
        tags: ["latest"],
    },
    {
        id: "chroma",
        name: "ChromaDB",
        image: "chromadb/chroma:latest",
        category: "ai",
        description: "Open-source embedding database for AI application memory and search.",
        defaultPorts: [{ host: "8000", container: "8000" }],
        defaultVolumes: [{ host: "chroma_data", container: "/chroma/chroma" }],
        tags: ["latest"],
    },
    {
        id: "vllm",
        name: "vLLM",
        image: "vllm/vllm-openai:latest",
        category: "ai",
        description: "High-throughput, low-latency LLM serving engine with OpenAI-compatible API.",
        defaultPorts: [{ host: "8000", container: "8000" }],
        tags: ["latest"],
    },

    // ── Runtimes ──
    {
        id: "node",
        name: "Node.js",
        image: "node:20-alpine",
        category: "runtime",
        description: "JavaScript runtime built on Chrome's V8 engine for building fast web apps and APIs.",
        defaultPorts: [{ host: "3000", container: "3000" }],
        tags: ["20-alpine", "22-alpine", "latest", "lts-alpine"],
    },
    {
        id: "python",
        name: "Python",
        image: "python:3.12-alpine",
        category: "runtime",
        description: "Modern Python programming language runtime with pip and virtual environment support.",
        defaultPorts: [{ host: "8000", container: "8000" }],
        tags: ["3.12-alpine", "3.11-alpine", "latest"],
    },
    {
        id: "bun",
        name: "Bun",
        image: "oven/bun:alpine",
        category: "runtime",
        description: "Incredibly fast all-in-one JavaScript & TypeScript runtime, bundler, and package manager.",
        defaultPorts: [{ host: "3000", container: "3000" }],
        tags: ["alpine", "latest", "debian"],
    },
    {
        id: "golang",
        name: "Golang",
        image: "golang:1.22-alpine",
        category: "runtime",
        description: "Official Go compiler and runtime environment for building fast, concurrent systems.",
        tags: ["1.22-alpine", "1.23-alpine", "latest"],
    },
    {
        id: "deno",
        name: "Deno",
        image: "denoland/deno:alpine",
        category: "runtime",
        description: "Next-generation secure JavaScript, TypeScript, and WebAssembly runtime.",
        defaultPorts: [{ host: "8000", container: "8000" }],
        tags: ["alpine", "latest"],
    },
    {
        id: "php",
        name: "PHP FPM",
        image: "php:8.3-fpm-alpine",
        category: "runtime",
        description: "FastCGI Process Manager implementation for PHP web applications.",
        defaultPorts: [{ host: "9000", container: "9000" }],
        tags: ["8.3-fpm-alpine", "8.2-fpm-alpine", "latest"],
    },
    {
        id: "rust",
        name: "Rust",
        image: "rust:alpine",
        category: "runtime",
        description: "Official Rust programming language compiler and Cargo toolchain.",
        tags: ["alpine", "latest"],
    },

    // ── Databases ──
    {
        id: "postgres",
        name: "PostgreSQL",
        image: "postgres:16-alpine",
        category: "database",
        description: "World's most advanced open source relational database.",
        defaultPorts: [{ host: "5432", container: "5432" }],
        defaultEnv: [{ key: "POSTGRES_PASSWORD", value: "" }],
        defaultVolumes: [{ host: "postgres_data", container: "/var/lib/postgresql/data" }],
        tags: ["16-alpine", "15-alpine", "latest"],
    },
    {
        id: "mysql",
        name: "MySQL",
        image: "mysql:8",
        category: "database",
        description: "Widely used open source relational database management system.",
        defaultPorts: [{ host: "3306", container: "3306" }],
        defaultEnv: [{ key: "MYSQL_ROOT_PASSWORD", value: "" }],
        defaultVolumes: [{ host: "mysql_data", container: "/var/lib/mysql" }],
        tags: ["8", "8.4", "latest"],
    },
    {
        id: "mariadb",
        name: "MariaDB",
        image: "mariadb:11",
        category: "database",
        description: "Fast, scalable open source relational database made by MySQL original creators.",
        defaultPorts: [{ host: "3306", container: "3306" }],
        defaultEnv: [{ key: "MARIADB_ROOT_PASSWORD", value: "" }],
        defaultVolumes: [{ host: "mariadb_data", container: "/var/lib/mysql" }],
        tags: ["11", "latest"],
    },
    {
        id: "mongo",
        name: "MongoDB",
        image: "mongo:7",
        category: "database",
        description: "Modern, document-oriented NoSQL general purpose database.",
        defaultPorts: [{ host: "27017", container: "27017" }],
        defaultVolumes: [{ host: "mongo_data", container: "/data/db" }],
        tags: ["7", "6", "latest"],
    },

    // ── Cache & Queue ──
    {
        id: "redis",
        name: "Redis",
        image: "redis:alpine",
        category: "cache",
        description: "In-memory key-value data store, cache, and message broker.",
        defaultPorts: [{ host: "6379", container: "6379" }],
        defaultVolumes: [{ host: "redis_data", container: "/data" }],
        tags: ["alpine", "7-alpine", "latest"],
    },
    {
        id: "rabbitmq",
        name: "RabbitMQ",
        image: "rabbitmq:3-management-alpine",
        category: "cache",
        description: "Robust open source message broker with web management interface.",
        defaultPorts: [
            { host: "5672", container: "5672" },
            { host: "15672", container: "15672" },
        ],
        tags: ["3-management-alpine", "latest"],
    },
    {
        id: "memcached",
        name: "Memcached",
        image: "memcached:alpine",
        category: "cache",
        description: "High-performance, distributed memory object caching system.",
        defaultPorts: [{ host: "11211", container: "11211" }],
        tags: ["alpine", "latest"],
    },

    // ── Dev Tools ──
    {
        id: "adminer",
        name: "Adminer",
        image: "adminer:latest",
        category: "tools",
        description: "Database management in a single PHP file supporting MySQL, Postgres, SQLite.",
        defaultPorts: [{ host: "8080", container: "8080" }],
        tags: ["latest"],
    },
    {
        id: "meilisearch",
        name: "Meilisearch",
        image: "getmeili/meilisearch:v1.7",
        category: "tools",
        description: "Lightning-fast, typo-tolerant search engine with intuitive REST APIs.",
        defaultPorts: [{ host: "7700", container: "7700" }],
        defaultVolumes: [{ host: "meili_data", container: "/meili_data" }],
        tags: ["v1.7", "latest"],
    },
    {
        id: "minio",
        name: "MinIO",
        image: "minio/minio:latest",
        category: "tools",
        description: "High-performance, S3-compatible cloud object storage service.",
        defaultPorts: [
            { host: "9000", container: "9000" },
            { host: "9001", container: "9001" },
        ],
        defaultVolumes: [{ host: "minio_data", container: "/data" }],
        defaultEnv: [
            { key: "MINIO_ROOT_USER", value: "admin" },
            { key: "MINIO_ROOT_PASSWORD", value: "password123" },
        ],
        tags: ["latest"],
    },
    {
        id: "uptime-kuma",
        name: "Uptime Kuma",
        image: "louislam/uptime-kuma:1",
        category: "tools",
        description: "Self-hosted monitoring tool for HTTP, TCP, Ping, and service uptime.",
        defaultPorts: [{ host: "3001", container: "3001" }],
        defaultVolumes: [{ host: "uptime_kuma", container: "/app/data" }],
        tags: ["1", "latest"],
    },
    {
        id: "alpine",
        name: "Alpine Linux",
        image: "alpine:latest",
        category: "tools",
        description: "Lightweight, security-oriented Linux distribution (~5MB).",
        tags: ["latest", "3.20"],
    },
    {
        id: "ubuntu",
        name: "Ubuntu",
        image: "ubuntu:latest",
        category: "tools",
        description: "Clean Ubuntu Linux official base container environment.",
        tags: ["latest", "24.04", "22.04"],
    },
];

export default function ContainersRoute({
    embedded = false,
    ownerFilter,
}: {
    embedded?: boolean;
    ownerFilter?: string;
} = {}) {
    const [containers, setContainers] = useState<ContainerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionLoading, setActionLoading] = useState("");
    const [logsContainer, setLogsContainer] = useState<ContainerRecord | null>(null);
    const [logs, setLogs] = useState("");
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsError, setLogsError] = useState("");
    const [dockerfileContainer, setDockerfileContainer] = useState<ContainerRecord | null>(null);
    const [dockerfileContent, setDockerfileContent] = useState("");
    const [dockerfilePath, setDockerfilePath] = useState("");
    const [dockerfileLoading, setDockerfileLoading] = useState(false);
    const [dockerfileSaving, setDockerfileSaving] = useState(false);
    const [dockerfileError, setDockerfileError] = useState("");

    const [searchTerm, setSearchTerm] = useState("");

    // Create container modal state
    const defaultOwner = ownerFilter || (runtime.isRoot ? "root" : runtime.username || "root");
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createTab, setCreateTab] = useState<"library" | "custom">("library");
    const [libSearch, setLibSearch] = useState("");
    const [libCategory, setLibCategory] = useState("all");
    const [selectedLibImage, setSelectedLibImage] = useState<LibraryImage | null>(LIBRARY_IMAGES[0]);

    const [createName, setCreateName] = useState("");
    const [createImage, setCreateImage] = useState("");
    const [createOwner, setCreateOwner] = useState(defaultOwner);
    const [createCommand, setCreateCommand] = useState("");
    const [createRestartPolicy, setCreateRestartPolicy] = useState("unless-stopped");
    const [createPorts, setCreatePorts] = useState<Array<{ host: string; container: string }>>([]);
    const [createVolumes, setCreateVolumes] = useState<Array<{ host: string; container: string }>>([]);
    const [createEnv, setCreateEnv] = useState<Array<{ key: string; value: string }>>([]);
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState("");
    const [users, setUsers] = useState<LinuxUser[]>([]);

    // Delete container modal state
    const [deleteModal, setDeleteModal] = useState<ContainerRecord | null>(null);

    useEffect(() => {
        if (!runtime.isRoot || ownerFilter) return;
        fetch("/post/user/list", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                const list: LinuxUser[] = (data?.users ?? []).filter((u: LinuxUser) => u.uid !== 0);
                setUsers(list);
            })
            .catch(() => setUsers([]));
    }, [ownerFilter]);

    const loadContainers = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(Api.current.containers, { cache: "no-store" });
            if (!response.ok) throw new Error((await response.text()) || "Failed to load containers");
            const data: { containers?: ContainerRecord[] } = await response.json();
            setContainers(data.containers ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Failed to load containers");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadContainers();
    }, [loadContainers]);

    const runAction = async (container: ContainerRecord, action: "start" | "stop" | "restart" | "rm") => {
        const key = `${container.engine}:${container.owner}:${container.id}:${action}`;
        setActionLoading(key);
        setError("");
        try {
            const response = await fetch(`${Api.current.containers}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, engine: container.engine, id: container.id, owner: container.owner }),
            });
            if (!response.ok) throw new Error((await response.text()) || `Failed to ${action} container`);
            await loadContainers();
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : `Failed to ${action} container`);
        } finally {
            setActionLoading("");
        }
    };

    const selectLibraryImage = (item: LibraryImage) => {
        setSelectedLibImage(item);
        setCreateImage(item.image);
        setCreatePorts(item.defaultPorts ? item.defaultPorts.map((p) => ({ ...p })) : []);
        setCreateVolumes(item.defaultVolumes ? item.defaultVolumes.map((v) => ({ ...v })) : []);
        setCreateEnv(item.defaultEnv ? item.defaultEnv.map((e) => ({ ...e })) : []);
        setCreateName(`${item.id}-1`);
    };

    const selectTag = (tag: string) => {
        if (!selectedLibImage) return;
        const base = selectedLibImage.image.split(":")[0];
        setCreateImage(`${base}:${tag}`);
    };

    const openCreateModal = () => {
        setCreateTab("library");
        const initial = LIBRARY_IMAGES[0];
        setSelectedLibImage(initial);
        setLibSearch("");
        setLibCategory("all");
        setCreateName(`${initial.id}-1`);
        setCreateImage(initial.image);
        setCreateOwner(defaultOwner);
        setCreateCommand("");
        setCreateRestartPolicy("unless-stopped");
        setCreatePorts(initial.defaultPorts ? initial.defaultPorts.map((p) => ({ ...p })) : []);
        setCreateVolumes(initial.defaultVolumes ? initial.defaultVolumes.map((v) => ({ ...v })) : []);
        setCreateEnv(initial.defaultEnv ? initial.defaultEnv.map((e) => ({ ...e })) : []);
        setCreateError("");
        setCreateModalOpen(true);
    };

    const handleCreateContainer = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmedImage = createImage.trim();
        if (!trimmedImage) {
            setCreateError("Container image is required.");
            return;
        }

        setCreateLoading(true);
        setCreateError("");

        try {
            const ports = createPorts
                .filter((p) => p.container.trim())
                .map((p) => (p.host.trim() ? `${p.host.trim()}:${p.container.trim()}` : p.container.trim()));

            const volumes = createVolumes
                .filter((v) => v.container.trim())
                .map((v) => (v.host.trim() ? `${v.host.trim()}:${v.container.trim()}` : v.container.trim()));

            const env: Record<string, string> = {};
            for (const item of createEnv) {
                const k = item.key.trim();
                if (k) {
                    env[k] = item.value;
                }
            }

            const payload = {
                name: createName.trim(),
                image: trimmedImage,
                owner: createOwner || defaultOwner,
                command: createCommand.trim(),
                restartPolicy: createRestartPolicy,
                ports,
                volumes,
                env,
            };

            const response = await fetch(`${Api.current.containers}/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || "Failed to create container");
            }

            setCreateModalOpen(false);
            await loadContainers();
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : "Failed to create container");
        } finally {
            setCreateLoading(false);
        }
    };

    const openLogs = async (container: ContainerRecord) => {
        setLogsContainer(container);
        setLogs("");
        setLogsError("");
        setLogsLoading(true);
        try {
            const query = new URLSearchParams({ engine: container.engine, id: container.id, owner: container.owner });
            const response = await fetch(`${Api.current.containers}/logs?${query.toString()}`, { cache: "no-store" });
            if (!response.ok) throw new Error((await response.text()) || "Failed to load container logs");
            const data: { logs?: string } = await response.json();
            setLogs(data.logs ?? "");
        } catch (logsLoadError) {
            setLogsError(logsLoadError instanceof Error ? logsLoadError.message : "Failed to load container logs");
        } finally {
            setLogsLoading(false);
        }
    };

    const dockerfileQuery = (container: ContainerRecord) => new URLSearchParams({
        engine: container.engine,
        id: container.id,
        owner: container.owner,
    });

    const openDockerfile = async (container: ContainerRecord) => {
        setDockerfileContainer(container);
        setDockerfileContent("");
        setDockerfilePath("");
        setDockerfileError("");
        setDockerfileLoading(true);
        try {
            const response = await fetch(`${Api.current.containers}/dockerfile?${dockerfileQuery(container)}`, { cache: "no-store" });
            if (!response.ok) throw new Error((await response.text()) || "Containerfile not found");
            const data: { content?: string; path?: string } = await response.json();
            setDockerfileContent(data.content ?? "");
            setDockerfilePath(data.path ?? "");
        } catch (dockerfileLoadError) {
            setDockerfileError(dockerfileLoadError instanceof Error ? dockerfileLoadError.message : "Containerfile not found");
        } finally {
            setDockerfileLoading(false);
        }
    };

    const saveDockerfile = async () => {
        if (!dockerfileContainer) return;
        setDockerfileSaving(true);
        setDockerfileError("");
        try {
            const response = await fetch(`${Api.current.containers}/dockerfile?${dockerfileQuery(dockerfileContainer)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: dockerfileContent }),
            });
            if (!response.ok) throw new Error((await response.text()) || "Failed to save Containerfile");
            setDockerfileContainer(null);
        } catch (dockerfileSaveError) {
            setDockerfileError(dockerfileSaveError instanceof Error ? dockerfileSaveError.message : "Failed to save Containerfile");
        } finally {
            setDockerfileSaving(false);
        }
    };

    const baseContainers = ownerFilter
        ? containers.filter((c) => c.owner === ownerFilter)
        : containers;

    const displayedContainers = searchTerm.trim()
        ? baseContainers.filter((c) => {
            const term = searchTerm.toLowerCase();
            return (
                c.name.toLowerCase().includes(term) ||
                c.id.toLowerCase().includes(term) ||
                c.image.toLowerCase().includes(term) ||
                c.owner.toLowerCase().includes(term)
            );
        })
        : baseContainers;

    const filteredLibImages = LIBRARY_IMAGES.filter((img) => {
        const matchesCat = libCategory === "all" || img.category === libCategory;
        const matchesSearch =
            !libSearch.trim() ||
            img.name.toLowerCase().includes(libSearch.toLowerCase()) ||
            img.image.toLowerCase().includes(libSearch.toLowerCase()) ||
            img.description.toLowerCase().includes(libSearch.toLowerCase());
        return matchesCat && matchesSearch;
    });

    const renderCommonConfig = () => (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Container Name</label>
                    <input
                        type="text"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        placeholder="e.g. my-app (optional)"
                        className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                    />
                </div>

                {runtime.isRoot && !ownerFilter ? (
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Owner</label>
                        <select
                            value={createOwner}
                            onChange={(e) => setCreateOwner(e.target.value)}
                            className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                        >
                            <option value="root">root (System Root)</option>
                            {users.map((u) => (
                                <option key={u.username} value={u.username}>
                                    {u.username}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Owner</label>
                        <input
                            type="text"
                            value={createOwner || defaultOwner}
                            disabled
                            className="h-8 w-full rounded border border-input bg-muted px-3 text-xs text-muted-foreground"
                        />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Restart Policy</label>
                    <select
                        value={createRestartPolicy}
                        onChange={(e) => setCreateRestartPolicy(e.target.value)}
                        className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                    >
                        <option value="unless-stopped">Unless Stopped (default)</option>
                        <option value="always">Always</option>
                        <option value="on-failure">On Failure</option>
                        <option value="no">No</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Command (optional)</label>
                    <input
                        type="text"
                        value={createCommand}
                        onChange={(e) => setCreateCommand(e.target.value)}
                        placeholder="e.g. sh -c 'npm start'"
                        className="h-8 w-full rounded border border-input bg-background px-3 font-mono text-xs outline-none focus:border-primary"
                    />
                </div>
            </div>
        </>
    );

    const renderPortsSection = () => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Port Mappings</label>
                <button
                    type="button"
                    onClick={() => setCreatePorts([...createPorts, { host: "", container: "" }])}
                    className="text-xs text-primary hover:underline"
                >
                    + Add Port
                </button>
            </div>
            {createPorts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No port mappings added.</p>
            ) : (
                <div className="space-y-2">
                    {createPorts.map((p, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={p.host}
                                onChange={(e) => {
                                    const next = [...createPorts];
                                    next[index] = { ...next[index], host: e.target.value };
                                    setCreatePorts(next);
                                }}
                                placeholder="Host (e.g. 8080)"
                                className="h-8 flex-1 rounded border border-input bg-background px-3 font-mono text-xs outline-none focus:border-primary"
                            />
                            <span className="text-xs text-muted-foreground">:</span>
                            <input
                                type="text"
                                value={p.container}
                                onChange={(e) => {
                                    const next = [...createPorts];
                                    next[index] = { ...next[index], container: e.target.value };
                                    setCreatePorts(next);
                                }}
                                placeholder="Container (e.g. 80)"
                                className="h-8 flex-1 rounded border border-input bg-background px-3 font-mono text-xs outline-none focus:border-primary"
                            />
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setCreatePorts(createPorts.filter((_, i) => i !== index))}
                                aria-label="Remove port mapping"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderVolumesSection = () => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div>
                    <label className="text-xs font-medium text-foreground">Volume Mounts</label>
                    <p className="text-xs text-muted-foreground">
                        {runtime.isRoot && createOwner === "root"
                            ? "Host Directory : Container Mount Path"
                            : "Directory relative to user home : Container Path"}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setCreateVolumes([...createVolumes, { host: "", container: "" }])}
                    className="text-xs text-primary hover:underline"
                >
                    + Add Volume
                </button>
            </div>
            {createVolumes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No volume mounts added.</p>
            ) : (
                <div className="space-y-2">
                    {createVolumes.map((v, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={v.host}
                                onChange={(e) => {
                                    const next = [...createVolumes];
                                    next[index] = { ...next[index], host: e.target.value };
                                    setCreateVolumes(next);
                                }}
                                placeholder="Host Path (e.g. /data or appdata)"
                                className="h-8 flex-1 rounded border border-input bg-background px-3 font-mono text-xs outline-none focus:border-primary"
                            />
                            <span className="text-xs text-muted-foreground">:</span>
                            <input
                                type="text"
                                value={v.container}
                                onChange={(e) => {
                                    const next = [...createVolumes];
                                    next[index] = { ...next[index], container: e.target.value };
                                    setCreateVolumes(next);
                                }}
                                placeholder="Container Path (e.g. /data)"
                                className="h-8 flex-1 rounded border border-input bg-background px-3 font-mono text-xs outline-none focus:border-primary"
                            />
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setCreateVolumes(createVolumes.filter((_, i) => i !== index))}
                                aria-label="Remove volume mount"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderEnvSection = () => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Environment Variables</label>
                <button
                    type="button"
                    onClick={() => setCreateEnv([...createEnv, { key: "", value: "" }])}
                    className="text-xs text-primary hover:underline"
                >
                    + Add Variable
                </button>
            </div>
            {createEnv.length === 0 ? (
                <p className="text-xs text-muted-foreground">No environment variables added.</p>
            ) : (
                <div className="space-y-2">
                    {createEnv.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={item.key}
                                onChange={(e) => {
                                    const next = [...createEnv];
                                    next[index] = { ...next[index], key: e.target.value };
                                    setCreateEnv(next);
                                }}
                                placeholder="KEY (e.g. PORT)"
                                className="h-8 flex-1 rounded border border-input bg-background px-3 font-mono text-xs outline-none focus:border-primary"
                            />
                            <span className="text-xs text-muted-foreground">=</span>
                            <input
                                type="text"
                                value={item.value}
                                onChange={(e) => {
                                    const next = [...createEnv];
                                    next[index] = { ...next[index], value: e.target.value };
                                    setCreateEnv(next);
                                }}
                                placeholder="Value (e.g. 3000)"
                                className="h-8 flex-1 rounded border border-input bg-background px-3 font-mono text-xs outline-none focus:border-primary"
                            />
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setCreateEnv(createEnv.filter((_, i) => i !== index))}
                                aria-label="Remove environment variable"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const content = (
        <div className="space-y-4">
            {embedded ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Containers</h3>
                        <p className="text-xs text-muted-foreground">Podman containers owned by {ownerFilter || "this user"}.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Filter containers..."
                                className="h-8 w-44 rounded border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
                            />
                        </div>
                        <Button size="sm" className="gap-2" onClick={openCreateModal}>
                            <Plus className="h-4 w-4" />
                            Create Container
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" onClick={loadContainers} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-3">
                    <div className="relative w-80">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name, owner, image..."
                            className="h-9 w-full rounded border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {displayedContainers.length} of {baseContainers.length} containers
                    </p>
                </div>
            )}

            {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            ) : null}

            {!error && !loading && displayedContainers.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed border-border p-6 text-center">
                    <ContainerIcon className="mb-3 h-9 w-9 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-foreground">No containers found</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {searchTerm.trim()
                            ? "No containers match your search filter."
                            : ownerFilter
                                ? `No Podman containers found for user "${ownerFilter}".`
                                : "Podman containers created by system or users will appear here."}
                    </p>
                    {!searchTerm.trim() && (
                        <Button size="sm" className="mt-4 gap-2" onClick={openCreateModal}>
                            <Plus className="h-4 w-4" />
                            Create Container
                        </Button>
                    )}
                </div>
            ) : null}

            {displayedContainers.length > 0 ? (
                <div className="overflow-hidden rounded-md border border-border bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1000px] text-left text-xs">
                            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Container</th>
                                    <th className="px-4 py-3 font-medium">Owner</th>
                                    <th className="px-4 py-3 font-medium">Image</th>
                                    <th className="px-4 py-3 font-medium">State</th>
                                    <th className="px-4 py-3 font-medium">Ports</th>
                                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {displayedContainers.map((container) => (
                                    <tr key={`${container.engine}:${container.owner}:${container.id}`} className="hover:bg-muted/30">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-foreground">{container.name || container.id.slice(0, 12)}</p>
                                            <code className="mt-0.5 block text-xs text-muted-foreground">{container.id.slice(0, 12)}</code>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                                                {container.owner}
                                            </span>
                                        </td>
                                        <td className="max-w-64 truncate px-4 py-3 text-foreground" title={container.image}>{container.image || "—"}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2 w-2 rounded-full ${container.state.toLowerCase() === "running" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                                                <span className="text-foreground">{container.status || container.state || "Unknown"}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {container.ports?.length ? container.ports.join(", ") : "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {container.state.toLowerCase() === "running" ? (
                                                    <Button size="icon" variant="outline" className="h-8 w-8" title="Stop" aria-label={`Stop ${container.name}`} disabled={Boolean(actionLoading)} onClick={() => runAction(container, "stop")}>
                                                        {actionLoading.endsWith(":stop") && actionLoading.includes(container.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                                                    </Button>
                                                ) : (
                                                    <Button size="icon" variant="outline" className="h-8 w-8 text-emerald-600" title="Start" aria-label={`Start ${container.name}`} disabled={Boolean(actionLoading)} onClick={() => runAction(container, "start")}>
                                                        {actionLoading.endsWith(":start") && actionLoading.includes(container.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                                    </Button>
                                                )}
                                                <Button size="icon" variant="outline" className="h-8 w-8" title="Restart" aria-label={`Restart ${container.name}`} disabled={Boolean(actionLoading) || container.state.toLowerCase() !== "running"} onClick={() => runAction(container, "restart")}>
                                                    {actionLoading.endsWith(":restart") && actionLoading.includes(container.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                                                </Button>
                                                <Button size="icon" variant="outline" className="h-8 w-8" title="Logs" aria-label={`View logs for ${container.name}`} onClick={() => openLogs(container)}>
                                                    <FileText className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button size="icon" variant="outline" className="h-8 w-8" title="Edit Containerfile" aria-label={`Edit Containerfile for ${container.name}`} onClick={() => openDockerfile(container)}>
                                                    <FileCode2 className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button size="icon" variant="outline" className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Remove" aria-label={`Remove ${container.name}`} disabled={Boolean(actionLoading)} onClick={() => setDeleteModal(container)}>
                                                    {actionLoading.endsWith(":rm") && actionLoading.includes(container.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            {/* Create Container Modal */}
            {createModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                    <div className="flex h-[min(840px,92vh)] w-full max-w-5xl flex-col overflow-hidden border border-border bg-card shadow-2xl">
                        {/* Header */}
                        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
                            <div className="flex items-center gap-2">
                                <ContainerIcon className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold text-foreground">Create Container</h3>
                            </div>
                            <button type="button" onClick={() => setCreateModalOpen(false)} aria-label="Close create container modal">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex shrink-0 border-b border-border bg-muted/20 px-5">
                            <button
                                type="button"
                                onClick={() => setCreateTab("library")}
                                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                                    createTab === "library"
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Layers className="h-4 w-4" />
                                Library (Docker Hub)
                            </button>
                            <button
                                type="button"
                                onClick={() => setCreateTab("custom")}
                                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                                    createTab === "custom"
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Wrench className="h-4 w-4" />
                                Custom Image / Build
                            </button>
                        </div>

                        <form onSubmit={handleCreateContainer} className="flex min-h-0 flex-1 flex-col">
                            {/* Tab 1: Library */}
                            {createTab === "library" && (
                                <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                                    {/* Left catalog list */}
                                    <div className="flex w-full flex-col border-b border-border md:w-5/12 md:border-b-0 md:border-r">
                                        {/* Search & Category filter */}
                                        <div className="border-b border-border p-3 space-y-2">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                                <input
                                                    type="text"
                                                    value={libSearch}
                                                    onChange={(e) => setLibSearch(e.target.value)}
                                                    placeholder="Search Docker Hub library..."
                                                    className="h-8 w-full rounded border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {LIB_CATEGORIES.map((cat) => (
                                                    <button
                                                        key={cat.id}
                                                        type="button"
                                                        onClick={() => setLibCategory(cat.id)}
                                                        className={`rounded px-2 py-0.5 text-xs transition-colors ${
                                                            libCategory === cat.id
                                                                ? "bg-primary font-medium text-primary-foreground"
                                                                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                                                        }`}
                                                    >
                                                        {cat.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* List of library images */}
                                        <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
                                            {filteredLibImages.map((item) => {
                                                const isSelected = selectedLibImage?.id === item.id;
                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => selectLibraryImage(item)}
                                                        className={`flex cursor-pointer items-start gap-3 rounded border p-2.5 transition-colors ${
                                                            isSelected
                                                                ? "border-primary bg-primary/5 text-foreground"
                                                                : "border-border bg-card text-foreground hover:bg-muted/40"
                                                        }`}
                                                    >
                                                        <div className={`mt-0.5 rounded p-2 ${isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                                            <Box className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="truncate font-semibold text-xs text-foreground">{item.name}</span>
                                                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                                                                    {item.image}
                                                                </span>
                                                            </div>
                                                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {filteredLibImages.length === 0 && (
                                                <div className="p-6 text-center text-xs text-muted-foreground">
                                                    No library images match your filter.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right configuration pane */}
                                    <div className="flex-1 space-y-4 overflow-y-auto p-5">
                                        {/* Selected Image Banner */}
                                        <div className="space-y-2 rounded border border-border bg-muted/20 p-3.5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="text-xs font-semibold text-foreground">{selectedLibImage?.name || "Select an Image"}</span>
                                                    <span className="ml-2 font-mono text-xs text-muted-foreground">{createImage}</span>
                                                </div>
                                                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-primary">
                                                    Docker Hub
                                                </span>
                                            </div>
                                            {selectedLibImage?.description && (
                                                <p className="text-xs text-muted-foreground">{selectedLibImage.description}</p>
                                            )}
                                            {/* Tag selection chips */}
                                            {selectedLibImage?.tags && selectedLibImage.tags.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                    <span className="text-xs text-muted-foreground">Tags:</span>
                                                    {selectedLibImage.tags.map((tag) => {
                                                        const isCurTag = createImage.endsWith(`:${tag}`);
                                                        return (
                                                            <button
                                                                key={tag}
                                                                type="button"
                                                                onClick={() => selectTag(tag)}
                                                                className={`rounded border px-2 py-0.5 font-mono text-xs transition-colors ${
                                                                    isCurTag
                                                                        ? "border-primary bg-primary font-semibold text-primary-foreground"
                                                                        : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                                                                }`}
                                                            >
                                                                {tag}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Image URI override */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">
                                                Image URI <span className="text-destructive">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={createImage}
                                                onChange={(e) => setCreateImage(e.target.value)}
                                                required
                                                className="h-8 w-full rounded border border-input bg-background px-3 font-mono text-xs outline-none focus:border-primary"
                                            />
                                        </div>

                                        {renderCommonConfig()}
                                        {renderPortsSection()}
                                        {renderVolumesSection()}
                                        {renderEnvSection()}
                                    </div>
                                </div>
                            )}

                            {/* Tab 2: Custom */}
                            {createTab === "custom" && (
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="mx-auto max-w-2xl space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">
                                                Container Image / Registry URI <span className="text-destructive">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={createImage}
                                                onChange={(e) => setCreateImage(e.target.value)}
                                                placeholder="e.g. docker.io/library/nginx:alpine, ghcr.io/org/repo:tag, or my-app:latest"
                                                required
                                                className="h-8 w-full rounded border border-input bg-background px-3 font-mono text-xs outline-none focus:border-primary"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Enter any image tag from Docker Hub, GitHub Container Registry (ghcr.io), Quay, or local build.
                                            </p>
                                        </div>

                                        {renderCommonConfig()}
                                        {renderPortsSection()}
                                        {renderVolumesSection()}
                                        {renderEnvSection()}
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
                                <div className="min-w-0 flex-1 pr-4">
                                    {createError ? (
                                        <p className="truncate text-xs font-medium text-destructive">{createError}</p>
                                    ) : (
                                        <span className="font-mono text-xs text-muted-foreground truncate block">
                                            {createImage ? `Target: ${createImage}` : ""}
                                        </span>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => setCreateModalOpen(false)} disabled={createLoading}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" size="sm" className="gap-2" disabled={createLoading}>
                                        {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                        {createLoading ? "Creating..." : "Create Container"}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Container Confirmation Modal */}
            {deleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm border border-border bg-card shadow-lg">
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <div className="flex items-center gap-2">
                                <Trash2 className="h-4 w-4 text-destructive" />
                                <h3 className="text-sm font-semibold text-foreground">Remove Container</h3>
                            </div>
                            <button type="button" onClick={() => setDeleteModal(null)} aria-label="Close modal">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-3 p-5">
                            <p className="text-xs text-muted-foreground">
                                Are you sure you want to permanently remove this container? This action cannot be undone.
                            </p>
                            <div className="border border-destructive/20 bg-destructive/5 px-3 py-2">
                                <p className="font-mono text-xs font-semibold text-destructive">{deleteModal.name || deleteModal.id.slice(0, 12)}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Owner: {deleteModal.owner} · Image: {deleteModal.image || "unknown"}
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                            <Button variant="outline" size="sm" onClick={() => setDeleteModal(null)} disabled={Boolean(actionLoading)}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={async () => {
                                    const target = deleteModal;
                                    setDeleteModal(null);
                                    await runAction(target, "rm");
                                }}
                                disabled={Boolean(actionLoading)}
                            >
                                {actionLoading.endsWith(":rm") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                Remove Container
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Logs Modal */}
            {logsContainer ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
                    <div className="flex h-[min(720px,90vh)] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-border bg-card shadow-xl">
                        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                            <div className="min-w-0">
                                <h2 className="text-sm font-semibold text-foreground">{logsContainer.name || logsContainer.id} logs</h2>
                                <p className="mt-1 text-xs text-muted-foreground">Last 200 lines · {logsContainer.engine} · {logsContainer.owner}</p>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setLogsContainer(null)} aria-label="Close logs">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto bg-zinc-950 p-5">
                            {logsLoading ? (
                                <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
                            ) : logsError ? (
                                <p className="whitespace-pre-wrap text-xs text-red-400">{logsError.trim()}</p>
                            ) : (
                                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-zinc-200">{logs || "No logs available."}</pre>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Edit Containerfile Modal */}
            {dockerfileContainer ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
                    <div className="flex h-[min(760px,90vh)] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-border bg-card shadow-xl">
                        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                            <div className="min-w-0">
                                <h2 className="text-sm font-semibold text-foreground">Edit Containerfile · {dockerfileContainer.name || dockerfileContainer.id}</h2>
                                <code className="mt-1 block break-all text-xs text-muted-foreground">{dockerfilePath || "Containerfile path unavailable"}</code>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDockerfileContainer(null)} disabled={dockerfileSaving} aria-label="Close Containerfile editor">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        {dockerfileError ? (
                            <div className="border-b border-destructive/20 bg-destructive/10 px-5 py-3 text-xs text-destructive">
                                {dockerfileError.trim()}
                                {!dockerfilePath ? <span className="mt-1 block text-muted-foreground">Add the label mthan.containerfile=/absolute/path/Containerfile (or mthan.dockerfile) when creating the container, or use Podman Compose from a directory containing Containerfile/Dockerfile.</span> : null}
                            </div>
                        ) : null}
                        <div className="min-h-0 flex-1 bg-background">
                            {dockerfileLoading ? (
                                <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                            ) : (
                                <textarea value={dockerfileContent} onChange={(event) => setDockerfileContent(event.target.value)} disabled={!dockerfilePath} spellCheck={false} className="h-full w-full resize-none bg-transparent p-5 font-mono text-xs leading-6 text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50" aria-label="Containerfile content" />
                            )}
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
                            <p className="text-xs text-muted-foreground">Saving does not rebuild the image or recreate the container.</p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setDockerfileContainer(null)} disabled={dockerfileSaving}>Cancel</Button>
                                <Button size="sm" className="gap-2" onClick={saveDockerfile} disabled={!dockerfilePath || dockerfileLoading || dockerfileSaving}>
                                    {dockerfileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );

    if (embedded) {
        return content;
    }

    return (
        <DashboardLayout
            title="Containers"
            description="View system and isolated rootless Podman containers."
            wide
            actions={
                <div className="flex items-center gap-2">
                    <Button size="sm" className="gap-2" onClick={openCreateModal}>
                        <Plus className="h-4 w-4" />
                        Create Container
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={loadContainers} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            }
        >
            {content}
        </DashboardLayout>
    );
}
