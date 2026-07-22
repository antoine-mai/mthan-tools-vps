import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe, Loader2, Pencil, RefreshCw, Save, Search, ShieldCheck, ShieldOff, Trash2, X } from "lucide-react";

import DashboardLayout from "_layouts/dashboard";
import { Button } from "_layouts/_components/ui/button";
import { runtime } from "../../runtime";

type CaddyVHost = {
    aliases: string[];
    hostname: string;
    listen: string[];
    server: "caddy";
    tls: boolean;
};

export default function VHostsRoute() {
    const [vhosts, setVhosts] = useState<CaddyVHost[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editing, setEditing] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const endpoint = runtime.isRoot ? "/post/vhost/list" : "/api/vhost/list";

    const loadVHosts = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(endpoint, { cache: "no-store" });
            if (!response.ok) throw new Error((await response.text()) || "Failed to load Caddy virtual hosts");
            const data: { vhosts?: CaddyVHost[] } = await response.json();
            setVhosts((data.vhosts ?? []).filter((vhost) => vhost.server === "caddy"));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Failed to load Caddy virtual hosts");
        } finally {
            setLoading(false);
        }
    }, [endpoint]);

    useEffect(() => {
        loadVHosts();
    }, [loadVHosts]);

    const filtered = useMemo(() => {
        const value = query.trim().toLowerCase();
        if (!value) return vhosts;
        return vhosts.filter((vhost) => vhost.hostname.toLowerCase().includes(value) || vhost.aliases.some((alias) => alias.toLowerCase().includes(value)));
    }, [query, vhosts]);

    const deleteVHost = async (hostname: string) => {
        if (!window.confirm(`Delete ${hostname} from the Caddyfile? This cannot be undone.`)) return;
        setDeleting(hostname);
        setError("");
        try {
            const response = await fetch(`/post/vhost/${encodeURIComponent(hostname)}`, { method: "DELETE" });
            if (!response.ok) throw new Error((await response.text()) || "Failed to delete virtual host");
            await loadVHosts();
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "Failed to delete virtual host");
        } finally {
            setDeleting(null);
        }
    };

    return (
        <DashboardLayout
            title="Caddy VHosts"
            description="View public hosts and routes loaded from the system Caddyfile."
            wide
            actions={
                <Button variant="outline" size="sm" className="gap-2" onClick={loadVHosts} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            }
        >
            <div className="space-y-4">
                <div className="flex h-10 max-w-md items-center gap-2 rounded-md border border-border bg-card px-3">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Caddy hosts..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                </div>

                {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error.trim()}</div> : null}

                {loading ? (
                    <div className="flex min-h-64 items-center justify-center rounded-md border border-border bg-card"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : filtered.length === 0 ? (
                    <div className="flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed border-border text-center">
                        <Globe className="mb-3 h-9 w-9 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-foreground">No Caddy virtual hosts found</p>
                        <p className="mt-1 text-xs text-muted-foreground">Add a host block to /etc/caddy/Caddyfile, then reload Caddy.</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-md border border-border bg-card">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-xs">
                                <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Hostname</th>
                                        <th className="px-4 py-3 font-medium">Aliases</th>
                                        <th className="px-4 py-3 font-medium">Listen</th>
                                        <th className="px-4 py-3 font-medium">TLS</th>
                                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filtered.map((vhost) => (
                                        <tr key={vhost.hostname} className="hover:bg-muted/30">
                                            <td className="px-4 py-3 font-medium text-foreground"><span className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />{vhost.hostname}</span></td>
                                            <td className="px-4 py-3 text-muted-foreground">{vhost.aliases.length ? vhost.aliases.join(", ") : "—"}</td>
                                            <td className="px-4 py-3 font-mono text-muted-foreground">{vhost.listen.length ? vhost.listen.join(", ") : ":80, :443"}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 ${vhost.tls ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                                    {vhost.tls ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                                                    {vhost.tls ? "Automatic" : "HTTP"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="inline-flex items-center gap-1.5">
                                                {runtime.isRoot ? <>
                                                    <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2 text-xs" onClick={() => setEditing(vhost.hostname)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                                                    <Button size="icon" variant="outline" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteVHost(vhost.hostname)} disabled={deleting === vhost.hostname} aria-label={`Delete ${vhost.hostname}`} title={`Delete ${vhost.hostname}`}>
                                                        {deleting === vhost.hostname ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                    </Button>
                                                </> : null}
                                                <a href={`${vhost.tls ? "https" : "http"}://${vhost.hostname}`} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Open ${vhost.hostname}`} title={`Open ${vhost.hostname}`}>
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            {editing ? <CaddyEditor hostname={editing} onClose={() => setEditing(null)} onSaved={loadVHosts} /> : null}
        </DashboardLayout>
    );
}

function CaddyEditor({ hostname, onClose, onSaved }: { hostname: string; onClose: () => void; onSaved: () => Promise<void> }) {
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const query = new URLSearchParams({ app: "caddy", path: "/etc/caddy/Caddyfile" });
        fetch(`/post/apps/config?${query}`, { cache: "no-store" })
            .then(async (response) => { if (!response.ok) throw new Error(await response.text()); return response.json(); })
            .then((data: { content: string }) => setContent(data.content ?? ""))
            .catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load Caddyfile"))
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true); setError("");
        try {
            const query = new URLSearchParams({ app: "caddy", path: "/etc/caddy/Caddyfile" });
            const response = await fetch(`/post/apps/config?${query}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
            if (!response.ok) throw new Error((await response.text()) || "Failed to save Caddyfile");
            const reload = await fetch("/post/vhost/reload", { method: "POST" });
            if (!reload.ok) throw new Error((await reload.text()) || "Caddyfile was saved, but Caddy could not be reloaded");
            await onSaved(); onClose();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Failed to save Caddyfile"); }
        finally { setSaving(false); }
    };

    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
        <div className="flex h-[min(720px,90vh)] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-semibold">Edit {hostname}</h2><code className="text-xs text-muted-foreground">/etc/caddy/Caddyfile</code></div><Button size="icon" variant="ghost" onClick={onClose} disabled={saving}><X className="h-4 w-4" /></Button></div>
            {error ? <div className="border-b border-destructive/20 bg-destructive/10 px-5 py-2 text-xs text-destructive">{error.trim()}</div> : null}
            <div className="min-h-0 flex-1 bg-background">{loading ? <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : <textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} className="h-full w-full resize-none bg-transparent p-5 font-mono text-xs leading-6 outline-none" />}</div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3"><Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button><Button size="sm" className="gap-2" onClick={save} disabled={loading || saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save & reload</Button></div>
        </div>
    </div>;
}
