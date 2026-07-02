import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from "react";

import Api from "_utils/api";

type UserContextType = {
    isLoggedIn: boolean;
    setIsLoggedIn: (status: boolean) => void;
    logout: () => void;
    checkSession: () => Promise<boolean>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
        return localStorage.getItem("is_logged_in") === "true";
    });

    useEffect(() => {
        localStorage.setItem("is_logged_in", isLoggedIn.toString());
    }, [isLoggedIn]);

    const logout = () => {
        setIsLoggedIn(false);
        localStorage.removeItem("is_logged_in");
        window.location.href = "/login";
    };

    const checkSession = useCallback(async (): Promise<boolean> => {
        const localStatus = localStorage.getItem("is_logged_in") === "true";
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
        } catch {
            // Treat network/session checks that cannot complete as logged out.
        }

        if (isLoggedIn) {
            setIsLoggedIn(false);
        }
        localStorage.removeItem("is_logged_in");
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

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
}
