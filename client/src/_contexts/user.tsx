import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from "react";

import Api from "_utils/api";
import { runtime } from "../runtime";

type UserContextType = {
    isLoggedIn: boolean;
    setIsLoggedIn: (status: boolean) => void;
    logout: () => void;
    checkSession: () => Promise<boolean>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function getLoginUrl(): string {
    const base = runtime.basePath ? runtime.basePath.replace(/\/+$/, "") : "";
    return `${base}/login`;
}

export function clearLoginStorage() {
    window.sessionStorage.removeItem("is_root_logged_in");
    window.localStorage.removeItem("is_user_logged_in");
}

export function redirectToLogin() {
    clearLoginStorage();
    const target = getLoginUrl();
    if (window.location.pathname !== target) {
        window.location.href = target;
    }
}

// Global fetch interceptor: automatically redirects to /login on 401 responses
let interceptorInstalled = false;
export function setupAuthInterceptor() {
    if (interceptorInstalled || typeof window === "undefined") return;
    interceptorInstalled = true;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (response.status === 401) {
            const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : "";
            // Do not redirect on login endpoints (to allow showing "invalid credentials" error) or ping
            if (!url.includes("/login") && !url.includes("/ping")) {
                redirectToLogin();
            }
        }
        return response;
    };
}

setupAuthInterceptor();

export function UserProvider({ children }: { children: ReactNode }) {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
        return loginStorage().getItem(loginStorageKey()) === "true";
    });

    useEffect(() => {
        loginStorage().setItem(loginStorageKey(), isLoggedIn.toString());
    }, [isLoggedIn]);

    const logout = () => {
        setIsLoggedIn(false);
        redirectToLogin();
    };

    const checkSession = useCallback(async (): Promise<boolean> => {
        const localStatus = loginStorage().getItem(loginStorageKey()) === "true";
        if (!localStatus) {
            if (isLoggedIn) {
                setIsLoggedIn(false);
            }
            redirectToLogin();
            return false;
        }

        try {
            const response = await fetch(Api.current.session, { cache: "no-store" });
            if (response.ok) {
                if (!isLoggedIn) {
                    setIsLoggedIn(true);
                }
                return true;
            }
            if (response.status !== 401 && response.status !== 403) {
                // Preserve the local session during transient restarts and gateway failures.
                return localStatus;
            }
        } catch {
            // Network failure: preserve local status so temporary offline doesn't force logout
            return localStatus;
        }

        if (isLoggedIn) {
            setIsLoggedIn(false);
        }
        redirectToLogin();
        return false;
    }, [isLoggedIn]);

    useEffect(() => {
        checkSession();

        const onFocus = () => {
            checkSession();
        };
        window.addEventListener("focus", onFocus);

        const interval = setInterval(() => {
            checkSession();
        }, 30000);

        return () => {
            window.removeEventListener("focus", onFocus);
            clearInterval(interval);
        };
    }, [checkSession]);

    return (
        <UserContext.Provider value={{ isLoggedIn, setIsLoggedIn, logout, checkSession }}>
            {children}
        </UserContext.Provider>
    );
}

function loginStorageKey() {
    return runtime.isRoot ? "is_root_logged_in" : "is_user_logged_in";
}

function loginStorage(): Storage {
    return runtime.isRoot ? window.sessionStorage : window.localStorage;
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
}
