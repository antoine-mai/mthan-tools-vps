import React, { useCallback, useEffect, useState } from "react";
import {
    Archive,
    Download,
    Loader2,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
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

interface BackupRouteProps {
    embedded?: boolean;
    username?: string;
}

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
    const [backups, setBackups] = useState<BackupItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Modals
    const [deleteModal, setDeleteModal] = useState<BackupItem | null>(null);
    const [restoreModal, setRestoreModal] = useState<BackupItem | null>(null);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [selectedCreateUser, setSelectedCreateUser] = useState(username || "");
    const [usersList, setUsersList] = useState<Array<{ username: string }>>([]);

    const activeUser = username || "";

    const fetchBackups = useCallback(async () => {
        setLoading(true);
        setError("");
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
            setError(err instanceof Error ? err.message : "Failed to load backups");
        } finally {
            setLoading(false);
        }
    }, [activeUser]);

    useEffect(() => {
        fetchBackups();
    }, [fetchBackups]);

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
        setError("");
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
            setError(err instanceof Error ? err.message : "Failed to create backup");
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
            setError(err instanceof Error ? err.message : "Failed to delete backup");
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
            setError(err instanceof Error ? err.message : "Failed to restore backup");
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
                        <Button variant="outline" size="sm" className="gap-2" onClick={fetchBackups} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            Refresh
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

            {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                    {error.trim()}
                </div>
            ) : null}

            {loading ? (
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

            {/* Create Backup Modal (when multiple users available) */}
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

            {/* Delete Modal */}
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

            {/* Restore Modal */}
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
        </div>
    );

    if (embedded) {
        return content;
    }

    return (
        <DashboardLayout
            title="Backup"
            description="Manage and restore user and system backup archives."
            wide
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={fetchBackups} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
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
