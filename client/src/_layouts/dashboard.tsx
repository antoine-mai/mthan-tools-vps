import { type ReactNode, useEffect } from "react";

import ColorModeSwitch from "_components/color-mode-switch";
import { runtime } from "runtime";
import { UserProvider, useUser } from "../_contexts/user";

type DashboardLayoutProps = {
    actions?: ReactNode;
    children: ReactNode;
    description?: string;
    title: string;
};

function DashboardLayoutContent({
    actions,
    children,
    description,
    title,
}: DashboardLayoutProps) {
    const { isLoggedIn, logout } = useUser();

    useEffect(() => {
        if (!isLoggedIn) {
            window.location.href = "/login";
        }
    }, [isLoggedIn]);

    const handleLogout = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        logout();
    };

    return (
        <main className="min-h-screen bg-background text-foreground">
            <header className="border-b border-border">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                            MThan VPS
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {runtime.mode}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
                            <a
                                className="transition-colors hover:text-foreground"
                                href="/"
                            >
                                Dashboard
                            </a>
                            <a
                                className="transition-colors hover:text-foreground"
                                href="/logout"
                                onClick={handleLogout}
                            >
                                Logout
                            </a>
                        </nav>
                        <ColorModeSwitch />
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-6xl px-6 py-8">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl space-y-2">
                        <h1 className="text-3xl font-semibold tracking-tight">
                            {title}
                        </h1>
                        {description ? (
                            <p className="text-sm leading-6 text-muted-foreground">
                                {description}
                            </p>
                        ) : null}
                    </div>

                    {actions ? (
                        <div className="flex flex-wrap gap-3">{actions}</div>
                    ) : null}
                </div>

                {children}
            </div>
        </main>
    );
}

export default function DashboardLayout(props: DashboardLayoutProps) {
    return (
        <UserProvider>
            <DashboardLayoutContent {...props} />
        </UserProvider>
    );
}
