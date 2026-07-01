import {
    LayoutDashboard,
    Server,
    Terminal,
    FileText,
    Settings,
    LogOut,
} from "lucide-react";
import { useUser } from "../../_contexts/user";
import { useApp } from "../../_contexts/app";

type SidebarProps = {
    className?: string;
};

export default function Sidebar({ className = "" }: SidebarProps) {
    const { logout } = useUser();
    const { mode } = useApp();

    const menuItems = [
        { icon: LayoutDashboard, label: "Dashboard", href: "/" },
        { icon: Server, label: "VPS Control", href: "/vps" },
        { icon: Terminal, label: "Terminal", href: "/terminal" },
        { icon: FileText, label: "System Logs", href: "/logs" },
        { icon: Settings, label: "Settings", href: "/settings" },
    ];

    const handleLogoutClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        logout();
    };

    return (
        <aside className={`flex h-screen w-64 flex-col border-r border-border bg-card text-card-foreground ${className}`}>
            {/* Logo area */}
            <div className="flex h-14 items-center gap-3 border-b border-border px-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-primary/10 text-primary">
                    <Server className="h-4.5 w-4.5" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold tracking-tight">MThan VPS</h2>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{mode} access</p>
                </div>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 space-y-1 px-4 py-6">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = window.location.pathname === item.href;
                    return (
                        <a
                            key={item.label}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            {item.label}
                        </a>
                    );
                })}
            </nav>

            {/* Footer / logout */}
            <div className="border-t border-border p-4">
                <button
                    onClick={handleLogoutClick}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Logout
                </button>
            </div>
        </aside>
    );
}
