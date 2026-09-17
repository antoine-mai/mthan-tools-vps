import { useCallback, useEffect, useState } from "react";
import {
    Container as ContainerIcon,
    FileCode2,
    FileText,
    Loader2,
    Play,
    Plus,
    RefreshCw,
    RotateCw,
    Save,
    Search,
    Square,
    Trash2,
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

const IMAGE_SUGGESTIONS = [
    { label: "Nginx", image: "nginx:alpine" },
    { label: "Redis", image: "redis:alpine" },
    { label: "Node.js", image: "node:20-alpine" },
    { label: "Python", image: "python:3.12-alpine" },
    { label: "PostgreSQL", image: "postgres:16-alpine" },
    { label: "MariaDB", image: "mariadb:11" },
    { label: "Ubuntu", image: "ubuntu:latest" },
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

    const openCreateModal = () => {
        setCreateName("");
        setCreateImage("");
        setCreateOwner(defaultOwner);
        setCreateCommand("");
        setCreateRestartPolicy("unless-stopped");
        setCreatePorts([]);
        setCreateVolumes([]);
        setCreateEnv([]);
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
                    <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden border border-border bg-card shadow-xl">
                        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
                            <div className="flex items-center gap-2">
                                <ContainerIcon className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold text-foreground">Create Container</h3>
                            </div>
                            <button type="button" onClick={() => setCreateModalOpen(false)} aria-label="Close create container modal">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateContainer} className="flex min-h-0 flex-1 flex-col">
                            <div className="flex-1 space-y-4 overflow-y-auto p-5">
                                {createError ? (
                                    <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                        {createError}
                                    </div>
                                ) : null}

                                {/* Container Image */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-foreground">
                                        Container Image <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={createImage}
                                        onChange={(e) => setCreateImage(e.target.value)}
                                        placeholder="e.g. nginx:alpine or docker.io/library/redis:alpine"
                                        required
                                        className="h-8 w-full rounded border border-input bg-background px-3 font-mono text-xs outline-none focus:border-primary"
                                    />
                                    {/* Image Suggestion Chips */}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                        <span className="text-xs text-muted-foreground">Quick images:</span>
                                        {IMAGE_SUGGESTIONS.map((item) => (
                                            <button
                                                key={item.image}
                                                type="button"
                                                onClick={() => setCreateImage(item.image)}
                                                className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                                                    createImage === item.image
                                                        ? "border-primary bg-primary/10 font-medium text-primary"
                                                        : "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                }`}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {/* Container Name */}
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

                                    {/* Owner Selection */}
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
                                    {/* Restart Policy */}
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

                                    {/* Command */}
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

                                {/* Port Mappings */}
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

                                {/* Volume Mounts */}
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

                                {/* Environment Variables */}
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
                            </div>

                            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-4">
                                <Button type="button" variant="outline" size="sm" onClick={() => setCreateModalOpen(false)} disabled={createLoading}>
                                    Cancel
                                </Button>
                                <Button type="submit" size="sm" className="gap-2" disabled={createLoading}>
                                    {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    {createLoading ? "Creating..." : "Create Container"}
                                </Button>
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
