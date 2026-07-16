import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from "react";

export type App = {
    id: string;
    name: string;
    domain: string;
    createdAt: string;
};

type AppsContextType = {
    apps: App[];
    addApp: (app: Omit<App, "id" | "createdAt">) => App;
    removeApp: (id: string) => void;
};

const AppsContext = createContext<AppsContextType | undefined>(undefined);

const STORAGE_KEY = "mthan_apps";

function loadApps(): App[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as App[];
    } catch {
        // ignore
    }
    return [];
}

function saveApps(apps: App[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

export function AppsProvider({ children }: { children: ReactNode }) {
    const [apps, setApps] = useState<App[]>(loadApps);

    useEffect(() => {
        saveApps(apps);
    }, [apps]);

    const addApp = useCallback((data: Omit<App, "id" | "createdAt">): App => {
        const newApp: App = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            ...data,
        };
        setApps((prev) => [...prev, newApp]);
        return newApp;
    }, []);

    const removeApp = useCallback((id: string) => {
        setApps((prev) => prev.filter((a) => a.id !== id));
    }, []);

    return (
        <AppsContext.Provider value={{ apps, addApp, removeApp }}>
            {children}
        </AppsContext.Provider>
    );
}

export function useApps() {
    const ctx = useContext(AppsContext);
    if (!ctx) throw new Error("useApps must be used within an AppsProvider");
    return ctx;
}
