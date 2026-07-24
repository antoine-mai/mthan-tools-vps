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

export function UserProvider({ children }: { children: ReactNode }) {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
        return loginStorage().getItem(loginStorageKey()) === "true";
    });

    useEffect(() => {
        loginStorage().setItem(loginStorageKey(), isLoggedIn.toString());
    }, [isLoggedIn]);

    const logout = () => {
        setIsLoggedIn(false);
        loginStorage().removeItem(loginStorageKey());
        window.location.href = `${runtime.basePath}/login`;
    };

    const checkSession = useCallback(async (): Promise<boolean> => {
        const localStatus = loginStorage().getItem(loginStorageKey()) === "true";
        if (!localStatus) {
            if (isLoggedIn) {
                setIsLoggedIn(false);
            }
            return false;
        }

        try {
            const response = await fetch(Api.current.session);
            if (response.ok) {
                if (!isLoggedIn) {
                    setIsLoggedIn(true);
                }
                return true;
            }
            if (response.status !== 401) {
                // Preserve the local session during transient restarts and gateway failures.
                return localStatus;
            }
        } catch {
            // The backend still validates every protected request. A temporary
            // network failure must not turn into a client-side logout.
            return localStatus;
        }

        if (isLoggedIn) {
            setIsLoggedIn(false);
        }
        loginStorage().removeItem(loginStorageKey());
        return false;
    }, [isLoggedIn]);

    useEffect(() => {
        checkSession();
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
