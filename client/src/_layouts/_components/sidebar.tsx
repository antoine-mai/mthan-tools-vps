import {
    LayoutDashboard,
    Server,
    Terminal,
    FileText,
    Settings,
    LogOut,
} from "lucide-react";
import { useUser } from "../../_contexts/user";

type SidebarProps = {
    className?: string;
};

export default function Sidebar({ className = "" }: SidebarProps) {
    const { logout } = useUser();

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
        <aside className={`flex h-screen w-[60px] flex-col border-r border-border bg-card text-card-foreground z-30 ${className}`}>
            {/* Logo area */}
            <div className="flex h-14 items-center justify-center border-b border-border">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-primary/10 text-primary">
                    <Server className="h-5 w-5" />
                </div>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 flex flex-col items-center gap-4 px-2 py-6">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = window.location.pathname === item.href;
                    return (
                        <a
                            key={item.label}
                            href={item.href}
                            className={`group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                            <Icon className="h-5 w-5 shrink-0" />
                            {/* Hover Tooltip */}
                            <span className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-150 rounded bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md border border-border whitespace-nowrap z-50">
                                {item.label}
                            </span>
                        </a>
                    );
                })}
            </nav>

            {/* Footer / logout */}
            <div className="border-t border-border p-2 flex justify-center">
                <button
                    onClick={handleLogoutClick}
                    className="group relative flex h-10 w-10 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                >
                    <LogOut className="h-5 w-5 shrink-0" />
                    {/* Hover Tooltip */}
                    <span className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-150 rounded bg-popover px-2.5 py-1.5 text-xs font-medium text-destructive shadow-md border border-border whitespace-nowrap z-50">
                        Logout
                    </span>
                </button>
            </div>
        </aside>
    );
}
