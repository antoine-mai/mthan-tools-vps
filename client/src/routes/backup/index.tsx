import React, { useCallback, useEffect, useState } from "react";
import {
    Archive,
    Cloud,
    Download,
    Edit2,
    Loader2,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Settings2,
    SlidersHorizontal,
    Trash2,
    X,
} from "lucide-react";

import DashboardLayout from "_layouts/dashboard";
import { Button } from "_layouts/_components/ui/button";
import { runtime } from "../../runtime";

export interface BackupItem {
    name: string;
    path: string;
    size: number;
    modTime: string;
    owner: string;
}

export interface BackupStorageItem {
    id: string;
    owner: string;
    name: string;
    provider: "s3" | "r2" | "gdrive" | "onedrive";
    bucket: string;
    pathPrefix: string;
    isDefault: boolean;
    config: Record<string, string>;
    createdAt: string;
    updatedAt: string;
}

interface BackupRouteProps {
    embedded?: boolean;
    username?: string;
}

const PROVIDERS = [
    { id: "s3", name: "Amazon S3", desc: "AWS S3 or any S3-compatible cloud storage (MinIO, Wasabi)" },
    { id: "r2", name: "Cloudflare R2", desc: "Cloudflare S3-compatible zero egress object storage" },
    { id: "gdrive", name: "Google Drive", desc: "Google Drive personal or workspace storage" },
    { id: "onedrive", name: "Microsoft OneDrive", desc: "Microsoft OneDrive personal or business storage" },
] as const;

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleString();
    } catch {
        return iso;
    }
}

export default function BackupRoute({ embedded = false, username }: BackupRouteProps) {
    const [backupSettingsOpen, setBackupSettingsOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState<"storage" | "general">("storage");

    // Backups state
    const [backups, setBackups] = useState<BackupItem[]>([]);
    const [loadingBackups, setLoadingBackups] = useState(true);
    const [backupError, setBackupError] = useState("");
    const [query, setQuery] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Storages state
    const [storages, setStorages] = useState<BackupStorageItem[]>([]);
    const [loadingStorages, setLoadingStorages] = useState(false);
    const [storageError, setStorageError] = useState("");

    // Modals
    const [deleteModal, setDeleteModal] = useState<BackupItem | null>(null);
    const [restoreModal, setRestoreModal] = useState<BackupItem | null>(null);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [selectedCreateUser, setSelectedCreateUser] = useState(username || "");
    const [usersList, setUsersList] = useState<Array<{ username: string }>>([]);

    // Storage Form Modal
    const [storageModalOpen, setStorageModalOpen] = useState(false);
    const [editingStorage, setEditingStorage] = useState<BackupStorageItem | null>(null);
    const [deleteStorageModal, setDeleteStorageModal] = useState<BackupStorageItem | null>(null);

    // Form fields
    const [formProvider, setFormProvider] = useState<"s3" | "r2" | "gdrive" | "onedrive">("s3");
    const [formName, setFormName] = useState("");
    const [formBucket, setFormBucket] = useState("");
    const [formPathPrefix, setFormPathPrefix] = useState("");
    const [formIsDefault, setFormIsDefault] = useState(false);
    const [formConfig, setFormConfig] = useState<Record<string, string>>({});
    const [formSaving, setFormSaving] = useState(false);
    const [formError, setFormError] = useState("");

    const activeUser = username || "";

    const fetchBackups = useCallback(async () => {
        setLoadingBackups(true);
        setBackupError("");
        try {
            const ep = runtime.isRoot
                ? activeUser
                    ? `/post/backup?user=${encodeURIComponent(activeUser)}`
                    : "/post/backup"
                : "/api/backup";
            const response = await fetch(ep, { cache: "no-store" });
            if (!response.ok) throw new Error((await response.text()) || "Failed to load backups");
            const data = await response.json();
            setBackups(data.backups || []);
        } catch (err) {
            setBackupError(err instanceof Error ? err.message : "Failed to load backups");
        } finally {
            setLoadingBackups(false);
        }
    }, [activeUser]);

    const fetchStorages = useCallback(async () => {
        setLoadingStorages(true);
        setStorageError("");
        try {
            const ep = runtime.isRoot
                ? activeUser
                    ? `/post/backup/storage?user=${encodeURIComponent(activeUser)}`
                    : "/post/backup/storage"
                : "/api/backup/storage";
            const response = await fetch(ep, { cache: "no-store" });
            if (!response.ok) throw new Error((await response.text()) || "Failed to load storage configurations");
            const data = await response.json();
            setStorages(data.storages || []);
        } catch (err) {
            setStorageError(err instanceof Error ? err.message : "Failed to load storage configurations");
        } finally {
            setLoadingStorages(false);
        }
    }, [activeUser]);

    useEffect(() => {
        fetchBackups();
        fetchStorages();
    }, [fetchBackups, fetchStorages]);

    useEffect(() => {
        if (runtime.isRoot && !activeUser) {
            fetch("/post/user/list", { cache: "no-store" })
                .then((r) => (r.ok ? r.json() : null))
                .then((data) => {
                    const list = (data?.users || []).filter((u: { uid: number }) => u.uid !== 0);
                    setUsersList(list);
                    if (list.length > 0 && !selectedCreateUser) {
                        setSelectedCreateUser(list[0].username);
                    }
                })
                .catch(() => {});
        }
    }, [activeUser, selectedCreateUser]);

    const handleCreateBackup = async () => {
        const targetUser = activeUser || selectedCreateUser;
        if (!targetUser) return;
        setActionLoading("create");
        setBackupError("");
        try {
            const ep = runtime.isRoot ? "/post/backup" : "/api/backup";
            const response = await fetch(ep, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user: targetUser }),
            });
            if (!response.ok) throw new Error((await response.text()) || "Failed to create backup");
            setCreateModalOpen(false);
            await fetchBackups();
        } catch (err) {
            setBackupError(err instanceof Error ? err.message : "Failed to create backup");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteBackup = async () => {
        if (!deleteModal) return;
        setActionLoading("delete");
        try {
            const ep = runtime.isRoot ? "/post/backup" : "/api/backup";
            const response = await fetch(ep, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user: deleteModal.owner, file: deleteModal.name }),
            });
            if (!response.ok) throw new Error((await response.text()) || "Failed to delete backup");
            setDeleteModal(null);
            await fetchBackups();
        } catch (err) {
            setBackupError(err instanceof Error ? err.message : "Failed to delete backup");
        } finally {
            setActionLoading(null);
        }
    };

    const handleRestoreBackup = async () => {
        if (!restoreModal) return;
        setActionLoading("restore");
        try {
            const ep = runtime.isRoot ? "/post/backup/restore" : "/api/backup/restore";
            const response = await fetch(ep, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user: restoreModal.owner, file: restoreModal.name }),
            });
            if (!response.ok) throw new Error((await response.text()) || "Failed to restore backup");
            setRestoreModal(null);
            alert("Backup restored successfully!");
        } catch (err) {
            setBackupError(err instanceof Error ? err.message : "Failed to restore backup");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDownload = (item: BackupItem) => {
        const ep = runtime.isRoot
            ? `/post/backup?download=true&user=${encodeURIComponent(item.owner)}&file=${encodeURIComponent(item.name)}`
            : `/api/backup?download=true&file=${encodeURIComponent(item.name)}`;
        window.open(ep, "_blank");
    };

    // Storage Management
    const openAddStorageModal = () => {
        setEditingStorage(null);
        setFormProvider("s3");
        setFormName("");
        setFormBucket("");
        setFormPathPrefix("");
        setFormIsDefault(storages.length === 0);
        setFormConfig({});
        setFormError("");
        setStorageModalOpen(true);
    };

    const openEditStorageModal = (item: BackupStorageItem) => {
        setEditingStorage(item);
        setFormProvider(item.provider);
        setFormName(item.name);
        setFormBucket(item.bucket);
        setFormPathPrefix(item.pathPrefix);
        setFormIsDefault(item.isDefault);
        setFormConfig({ ...item.config });
        setFormError("");
        setStorageModalOpen(true);
    };

    const handleSaveStorage = async () => {
        if (!formName.trim()) {
            setFormError("Storage name is required.");
            return;
        }
        setFormSaving(true);
        setFormError("");

        const payload: Partial<BackupStorageItem> = {
            id: editingStorage ? editingStorage.id : "",
            owner: activeUser,
            name: formName.trim(),
            provider: formProvider,
            bucket: formBucket.trim(),
            pathPrefix: formPathPrefix.trim(),
            isDefault: formIsDefault,
            config: formConfig,
        };

        try {
            const ep = runtime.isRoot ? "/post/backup/storage" : "/api/backup/storage";
            const response = await fetch(ep, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error((await response.text()) || "Failed to save storage");
            setStorageModalOpen(false);
            await fetchStorages();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Failed to save storage");
        } finally {
            setFormSaving(false);
        }
    };

    const handleDeleteStorage = async () => {
        if (!deleteStorageModal) return;
        try {
            const ep = runtime.isRoot
                ? `/post/backup/storage?id=${encodeURIComponent(deleteStorageModal.id)}`
                : `/api/backup/storage?id=${encodeURIComponent(deleteStorageModal.id)}`;
            const response = await fetch(ep, { method: "DELETE" });
            if (!response.ok) throw new Error((await response.text()) || "Failed to delete storage");
            setDeleteStorageModal(null);
            await fetchStorages();
        } catch (err) {
            setStorageError(err instanceof Error ? err.message : "Failed to delete storage");
        }
    };

    const filtered = backups.filter((b) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
            b.name.toLowerCase().includes(q) ||
            b.owner.toLowerCase().includes(q)
        );
    });

    const content = (
        <div className="space-y-4">
            <div className="space-y-4">
                {/* Header / Actions bar */}
                {embedded ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">User Backups</h3>
                            <p className="text-xs text-muted-foreground">
                                Manage backup archives stored in {activeUser}&apos;s home backup directory.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Filter backups…"
                                    className="h-8 w-44 rounded border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
                                />
                            </div>
                            <Button variant="outline" size="sm" className="gap-2" onClick={fetchBackups} disabled={loadingBackups}>
                                <RefreshCw className={`h-4 w-4 ${loadingBackups ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                    fetchStorages();
                                    setBackupSettingsOpen(true);
                                }}
                            >
                                <Settings2 className="h-4 w-4" />
                                Settings
                            </Button>
                            <Button
                                size="sm"
                                className="gap-2"
                                onClick={handleCreateBackup}
                                disabled={actionLoading !== null}
                            >
                                {actionLoading === "create" ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Plus className="h-4 w-4" />
                                )}
                                Create Backup
                            </Button>
                        </div>
                    </div>
                ) : (
                        <div className="flex items-center justify-between gap-3">
                            <div className="relative w-80">
                                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search by archive name or user…"
                                    className="h-9 w-full rounded border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {filtered.length} of {backups.length} backup{backups.length !== 1 ? "s" : ""}
                            </p>
                        </div>
                    )}

                    {backupError ? (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                            {backupError.trim()}
                        </div>
                    ) : null}

                    {loadingBackups ? (
                        <div className="flex min-h-64 items-center justify-center rounded-md border border-border bg-card">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed border-border p-8 text-center">
                            <Archive className="mb-3 h-10 w-10 text-muted-foreground/40" />
                            <p className="text-sm font-medium text-foreground">No backups found</p>
                            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                                Create a compressed archive of user websites, files, and configurations to safeguard your data.
                            </p>
                            <Button
                                size="sm"
                                className="mt-4 gap-2"
                                onClick={() => {
                                    if (activeUser) {
                                        handleCreateBackup();
                                    } else {
                                        setCreateModalOpen(true);
                                    }
                                }}
                            >
                                <Plus className="h-4 w-4" />
                                Create first backup
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-md border border-border bg-card">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] text-left text-xs">
                                    <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Archive Name</th>
                                            {!embedded && <th className="px-4 py-3 font-medium">Owner</th>}
                                            <th className="px-4 py-3 font-medium">Size</th>
                                            <th className="px-4 py-3 font-medium">Date Created</th>
                                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {filtered.map((item) => (
                                            <tr key={item.path} className="hover:bg-muted/30">
                                                <td className="px-4 py-3 font-medium text-foreground">
                                                    <span className="flex items-center gap-2">
                                                        <Archive className="h-4 w-4 text-primary shrink-0" />
                                                        <span className="font-mono">{item.name}</span>
                                                    </span>
                                                </td>
                                                {!embedded && (
                                                    <td className="px-4 py-3">
                                                        <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                                                            {item.owner}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 font-mono text-muted-foreground">
                                                    {formatBytes(item.size)}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {formatDate(item.modTime)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 gap-1 px-2 text-xs"
                                                            onClick={() => handleDownload(item)}
                                                            title="Download archive"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                            Download
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 gap-1 px-2 text-xs text-amber-600 hover:bg-amber-500/10 border-amber-500/20"
                                                            onClick={() => setRestoreModal(item)}
                                                            title="Restore archive"
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                            Restore
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 border-destructive/20"
                                                            onClick={() => setDeleteModal(item)}
                                                            title="Delete archive"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

            {/* Backup Settings Modal */}
            {backupSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[85vh] w-full max-w-3xl flex-col border border-border bg-card shadow-lg">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <div className="flex items-center gap-2.5">
                                <Settings2 className="h-5 w-5 text-primary" />
                                <h3 className="text-sm font-semibold text-foreground">Backup Settings</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setBackupSettingsOpen(false)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Sub-navigation Tabs */}
                        <div className="flex border-b border-border px-5 bg-muted/20">
                            <button
                                type="button"
                                onClick={() => setSettingsTab("storage")}
                                className={`flex items-center gap-2 border-b-2 py-2.5 px-3 text-xs font-semibold transition-colors ${
                                    settingsTab === "storage"
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Cloud className="h-4 w-4" />
                                Storage Destinations
                                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-normal">
                                    {storages.length}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSettingsTab("general")}
                                className={`flex items-center gap-2 border-b-2 py-2.5 px-3 text-xs font-semibold transition-colors ${
                                    settingsTab === "general"
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <SlidersHorizontal className="h-4 w-4" />
                                General
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {settingsTab === "storage" && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-foreground">Storage Locations</h4>
                                        <Button size="sm" className="gap-1.5" onClick={openAddStorageModal}>
                                            <Plus className="h-4 w-4" />
                                            Add Storage
                                        </Button>
                                    </div>

                                    {storageError ? (
                                        <div className="rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                                            {storageError.trim()}
                                        </div>
                                    ) : null}

                                    {loadingStorages ? (
                                        <div className="flex min-h-56 items-center justify-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : storages.length === 0 ? (
                                        <div className="flex min-h-56 flex-col items-center justify-center rounded border border-dashed border-border p-8 text-center">
                                            <Cloud className="mb-3 h-10 w-10 text-muted-foreground/40" />
                                            <p className="text-sm font-medium text-foreground">No storage destinations configured</p>
                                            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                                                Add an S3 bucket, Cloudflare R2 bucket, Google Drive folder, or OneDrive destination to manage remote backups.
                                            </p>
                                            <Button size="sm" className="mt-4 gap-2" onClick={openAddStorageModal}>
                                                <Plus className="h-4 w-4" />
                                                Add Storage Destination
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            {storages.map((st) => (
                                                <div key={st.id} className="relative flex flex-col justify-between rounded border border-border bg-background p-4 shadow-sm">
                                                    <div>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="rounded bg-primary/10 p-2 text-primary">
                                                                    <Cloud className="h-4 w-4" />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                                                        {st.name}
                                                                        {st.isDefault && (
                                                                            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                                                                Default
                                                                            </span>
                                                                        )}
                                                                    </h4>
                                                                    <p className="text-xs text-muted-foreground capitalize">
                                                                        {st.provider === "s3"
                                                                            ? "Amazon S3 / Compatible"
                                                                            : st.provider === "r2"
                                                                            ? "Cloudflare R2"
                                                                            : st.provider === "gdrive"
                                                                            ? "Google Drive"
                                                                            : "Microsoft OneDrive"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7"
                                                                    onClick={() => openEditStorageModal(st)}
                                                                    title="Edit storage"
                                                                >
                                                                    <Edit2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                    onClick={() => setDeleteStorageModal(st)}
                                                                    title="Delete storage"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div className="mt-3 space-y-1 rounded bg-muted/40 p-2.5 text-xs">
                                                            {st.bucket && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Bucket:</span>
                                                                    <span className="font-mono font-medium text-foreground">{st.bucket}</span>
                                                                </div>
                                                            )}
                                                            {st.pathPrefix && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Path / Prefix:</span>
                                                                    <span className="font-mono text-foreground">{st.pathPrefix}</span>
                                                                </div>
                                                            )}
                                                            {st.config?.region && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Region:</span>
                                                                    <span className="font-mono text-foreground">{st.config.region}</span>
                                                                </div>
                                                            )}
                                                            {st.config?.endpoint && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Endpoint:</span>
                                                                    <span className="truncate max-w-[200px] font-mono text-foreground" title={st.config.endpoint}>{st.config.endpoint}</span>
                                                                </div>
                                                            )}
                                                            {st.config?.folder_id && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Folder ID:</span>
                                                                    <span className="font-mono text-foreground">{st.config.folder_id}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 pt-2 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
                                                        <span>Configured {formatDate(st.createdAt)}</span>
                                                        {!embedded && st.owner && (
                                                            <span className="font-mono font-medium">Owner: {st.owner}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {settingsTab === "general" && (
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-sm font-semibold text-foreground">General Preferences</h4>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="rounded border border-border bg-background p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h5 className="text-xs font-semibold text-foreground">Default Remote Destination</h5>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        The default storage target configured for automated offsite sync.
                                                    </p>
                                                </div>
                                                <span className="font-mono text-xs font-medium text-primary">
                                                    {storages.find((s) => s.isDefault)?.name || "None (Local only)"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="rounded border border-border bg-background p-4 space-y-2">
                                            <div>
                                                <h5 className="text-xs font-semibold text-foreground">Local Storage Directory</h5>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Backup archives are generated and stored in each user&apos;s isolated home directory:
                                                </p>
                                            </div>
                                            <div className="rounded bg-muted/40 p-2 font-mono text-xs text-foreground">
                                                /home/{`{username}`}/backups/
                                            </div>
                                        </div>

                                        <div className="rounded border border-border bg-background p-4 space-y-2">
                                            <div>
                                                <h5 className="text-xs font-semibold text-foreground">Archive Packaging Format</h5>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Uses standard gzip-compressed tarballs (.tar.gz) preserving Unix ownership and file permissions.
                                                </p>
                                            </div>
                                            <div className="rounded bg-muted/40 p-2 font-mono text-xs text-foreground">
                                                backup-{`{username}`}-{`{timestamp}`}.tar.gz
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end border-t border-border px-5 py-3">
                            <Button variant="outline" size="sm" onClick={() => setBackupSettingsOpen(false)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Backup Modal */}
            {createModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm border border-border bg-card shadow-lg">
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <div className="flex items-center gap-2">
                                <Archive className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold">Create Backup</h3>
                            </div>
                            <button type="button" onClick={() => setCreateModalOpen(false)}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-3 p-5">
                            <label className="block space-y-1.5 text-xs font-medium">
                                <span>Select User</span>
                                <select
                                    value={selectedCreateUser}
                                    onChange={(e) => setSelectedCreateUser(e.target.value)}
                                    className="h-9 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                >
                                    {usersList.map((u) => (
                                        <option key={u.username} value={u.username}>
                                            {u.username}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                This will create a compressed archive of the user&apos;s htdocs, data, and config directories into their backup folder.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
                            <Button
                                className="gap-2"
                                onClick={handleCreateBackup}
                                disabled={actionLoading === "create" || !selectedCreateUser}
                            >
                                {actionLoading === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Create
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Backup Modal */}
            {deleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm border border-border bg-card shadow-lg">
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <div className="flex items-center gap-2">
                                <Trash2 className="h-4 w-4 text-destructive" />
                                <h3 className="text-sm font-semibold">Delete Backup</h3>
                            </div>
                            <button type="button" onClick={() => setDeleteModal(null)}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-3 p-5">
                            <p className="text-xs text-muted-foreground">
                                Are you sure you want to permanently delete this backup archive?
                            </p>
                            <div className="border border-destructive/20 bg-destructive/5 px-3 py-2">
                                <p className="font-mono text-xs font-semibold text-destructive">{deleteModal.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(deleteModal.size)}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                            <Button variant="outline" onClick={() => setDeleteModal(null)}>Cancel</Button>
                            <Button
                                className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={handleDeleteBackup}
                                disabled={actionLoading === "delete"}
                            >
                                {actionLoading === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Restore Backup Modal */}
            {restoreModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm border border-border bg-card shadow-lg">
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <div className="flex items-center gap-2">
                                <RotateCcw className="h-4 w-4 text-amber-600" />
                                <h3 className="text-sm font-semibold">Restore Backup</h3>
                            </div>
                            <button type="button" onClick={() => setRestoreModal(null)}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-3 p-5">
                            <p className="text-xs text-muted-foreground">
                                Restoring this archive will overwrite existing files in {restoreModal.owner}&apos;s directory with files from this backup.
                            </p>
                            <div className="border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                                <p className="font-mono text-xs font-semibold text-foreground">{restoreModal.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(restoreModal.modTime)}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                            <Button variant="outline" onClick={() => setRestoreModal(null)}>Cancel</Button>
                            <Button
                                className="gap-2 bg-amber-600 text-white hover:bg-amber-700"
                                onClick={handleRestoreBackup}
                                disabled={actionLoading === "restore"}
                            >
                                {actionLoading === "restore" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                Restore Now
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add / Edit Storage Modal */}
            {storageModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg border border-border bg-card shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <Cloud className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold">
                                    {editingStorage ? "Edit Storage Location" : "Add Storage Location"}
                                </h3>
                            </div>
                            <button type="button" onClick={() => setStorageModalOpen(false)}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-4 p-5 overflow-y-auto flex-1">
                            {formError && (
                                <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                    {formError}
                                </div>
                            )}

                            {/* Provider Selection */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground">Storage Provider</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PROVIDERS.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setFormProvider(p.id)}
                                            className={`flex flex-col text-left p-3 rounded border text-xs transition-colors ${
                                                formProvider === p.id
                                                    ? "border-primary bg-primary/5 text-primary"
                                                    : "border-border bg-background text-muted-foreground hover:border-foreground/30"
                                            }`}
                                        >
                                            <span className="font-semibold text-foreground">{p.name}</span>
                                            <span className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{p.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Storage Name */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Storage Name</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="e.g. My Cloudflare R2 / AWS S3"
                                    className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                />
                            </div>

                            {/* Fields for S3 */}
                            {formProvider === "s3" && (
                                <div className="space-y-3 pt-2 border-t border-border">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Access Key ID</label>
                                            <input
                                                type="text"
                                                value={formConfig.access_key_id || ""}
                                                onChange={(e) => setFormConfig({ ...formConfig, access_key_id: e.target.value })}
                                                placeholder="AKIAIOSFODNN7EXAMPLE"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs font-mono outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Secret Access Key</label>
                                            <input
                                                type="password"
                                                value={formConfig.secret_access_key || ""}
                                                onChange={(e) => setFormConfig({ ...formConfig, secret_access_key: e.target.value })}
                                                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs font-mono outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Bucket Name</label>
                                            <input
                                                type="text"
                                                value={formBucket}
                                                onChange={(e) => setFormBucket(e.target.value)}
                                                placeholder="my-backup-bucket"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Region</label>
                                            <input
                                                type="text"
                                                value={formConfig.region || ""}
                                                onChange={(e) => setFormConfig({ ...formConfig, region: e.target.value })}
                                                placeholder="us-east-1"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Custom Endpoint URL (Optional)</label>
                                            <input
                                                type="text"
                                                value={formConfig.endpoint || ""}
                                                onChange={(e) => setFormConfig({ ...formConfig, endpoint: e.target.value })}
                                                placeholder="https://s3.wasabisys.com"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Folder / Prefix (Optional)</label>
                                            <input
                                                type="text"
                                                value={formPathPrefix}
                                                onChange={(e) => setFormPathPrefix(e.target.value)}
                                                placeholder="backups/"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Fields for Cloudflare R2 */}
                            {formProvider === "r2" && (
                                <div className="space-y-3 pt-2 border-t border-border">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-foreground">Cloudflare Account ID</label>
                                        <input
                                            type="text"
                                            value={formConfig.account_id || ""}
                                            onChange={(e) => setFormConfig({ ...formConfig, account_id: e.target.value })}
                                            placeholder="e.g. 7c9a4b2e8f1d3c5a6b7e8f9d0a1b2c3d"
                                            className="h-8 w-full rounded border border-input bg-background px-3 text-xs font-mono outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">R2 Access Key ID</label>
                                            <input
                                                type="text"
                                                value={formConfig.access_key_id || ""}
                                                onChange={(e) => setFormConfig({ ...formConfig, access_key_id: e.target.value })}
                                                placeholder="R2 Access Key ID"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs font-mono outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">R2 Secret Access Key</label>
                                            <input
                                                type="password"
                                                value={formConfig.secret_access_key || ""}
                                                onChange={(e) => setFormConfig({ ...formConfig, secret_access_key: e.target.value })}
                                                placeholder="R2 Secret Key"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs font-mono outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Bucket Name</label>
                                            <input
                                                type="text"
                                                value={formBucket}
                                                onChange={(e) => setFormBucket(e.target.value)}
                                                placeholder="r2-backup-bucket"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Folder / Prefix (Optional)</label>
                                            <input
                                                type="text"
                                                value={formPathPrefix}
                                                onChange={(e) => setFormPathPrefix(e.target.value)}
                                                placeholder="vps-backups/"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Fields for Google Drive */}
                            {formProvider === "gdrive" && (
                                <div className="space-y-3 pt-2 border-t border-border">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Client ID (OAuth)</label>
                                            <input
                                                type="text"
                                                value={formConfig.client_id || ""}
                                                onChange={(e) => setFormConfig({ ...formConfig, client_id: e.target.value })}
                                                placeholder="xxxx.apps.googleusercontent.com"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Client Secret</label>
                                            <input
                                                type="password"
                                                value={formConfig.client_secret || ""}
                                                onChange={(e) => setFormConfig({ ...formConfig, client_secret: e.target.value })}
                                                placeholder="GOCSPX-xxxx"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-foreground">Folder ID / Path (Optional)</label>
                                        <input
                                            type="text"
                                            value={formConfig.folder_id || ""}
                                            onChange={(e) => setFormConfig({ ...formConfig, folder_id: e.target.value })}
                                            placeholder="Google Drive Folder ID or name"
                                            className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-foreground">Refresh Token / Access Token JSON</label>
                                        <textarea
                                            value={formConfig.token || ""}
                                            onChange={(e) => setFormConfig({ ...formConfig, token: e.target.value })}
                                            placeholder='{"access_token":"...","token_type":"Bearer","refresh_token":"..."}'
                                            className="h-20 w-full rounded border border-input bg-background p-2.5 text-xs font-mono outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Fields for Microsoft OneDrive */}
                            {formProvider === "onedrive" && (
                                <div className="space-y-3 pt-2 border-t border-border">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Client ID (Application ID)</label>
                                            <input
                                                type="text"
                                                value={formConfig.client_id || ""}
                                                onChange={(e) => setFormConfig({ ...formConfig, client_id: e.target.value })}
                                                placeholder="Azure App Client ID"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Client Secret</label>
                                            <input
                                                type="password"
                                                value={formConfig.client_secret || ""}
                                                onChange={(e) => setFormConfig({ ...formConfig, client_secret: e.target.value })}
                                                placeholder="Azure App Client Secret"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Drive ID (Optional)</label>
                                            <input
                                                type="text"
                                                value={formConfig.drive_id || ""}
                                                onChange={(e) => setFormConfig({ ...formConfig, drive_id: e.target.value })}
                                                placeholder="Leave blank for personal drive"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Folder Path (Optional)</label>
                                            <input
                                                type="text"
                                                value={formPathPrefix}
                                                onChange={(e) => setFormPathPrefix(e.target.value)}
                                                placeholder="Backups/VPS"
                                                className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-foreground">OAuth Token JSON</label>
                                        <textarea
                                            value={formConfig.token || ""}
                                            onChange={(e) => setFormConfig({ ...formConfig, token: e.target.value })}
                                            placeholder='{"token_type":"Bearer","refresh_token":"..."}'
                                            className="h-20 w-full rounded border border-input bg-background p-2.5 text-xs font-mono outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Set Default */}
                            <label className="flex items-center gap-2 pt-2 cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={formIsDefault}
                                    onChange={(e) => setFormIsDefault(e.target.checked)}
                                    className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                                />
                                <span className="text-foreground">Set as default storage destination</span>
                            </label>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-border px-5 py-4 shrink-0">
                            <Button variant="outline" onClick={() => setStorageModalOpen(false)}>Cancel</Button>
                            <Button className="gap-2" onClick={handleSaveStorage} disabled={formSaving}>
                                {formSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Save Storage
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Storage Modal */}
            {deleteStorageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm border border-border bg-card shadow-lg">
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <div className="flex items-center gap-2">
                                <Trash2 className="h-4 w-4 text-destructive" />
                                <h3 className="text-sm font-semibold">Delete Storage Destination</h3>
                            </div>
                            <button type="button" onClick={() => setDeleteStorageModal(null)}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-3 p-5">
                            <p className="text-xs text-muted-foreground">
                                Are you sure you want to remove this storage configuration? Remote backup files already stored in the cloud will not be deleted.
                            </p>
                            <div className="border border-destructive/20 bg-destructive/5 px-3 py-2">
                                <p className="font-mono text-xs font-semibold text-destructive">{deleteStorageModal.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{deleteStorageModal.provider}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                            <Button variant="outline" onClick={() => setDeleteStorageModal(null)}>Cancel</Button>
                            <Button
                                className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={handleDeleteStorage}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    if (embedded) {
        return content;
    }

    return (
        <DashboardLayout
            title="Backup"
            description="Manage local backup archives and configure cloud storage destinations."
            wide
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={fetchBackups} disabled={loadingBackups}>
                        <RefreshCw className={`h-4 w-4 ${loadingBackups ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                            fetchStorages();
                            setBackupSettingsOpen(true);
                        }}
                    >
                        <Settings2 className="h-4 w-4" />
                        Settings
                    </Button>
                    <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                            if (activeUser) {
                                handleCreateBackup();
                            } else {
                                setCreateModalOpen(true);
                            }
                        }}
                        disabled={actionLoading !== null}
                    >
                        {actionLoading === "create" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="h-4 w-4" />
                        )}
                        Create Backup
                    </Button>
                </div>
            }
        >
            {content}
        </DashboardLayout>
    );
}
