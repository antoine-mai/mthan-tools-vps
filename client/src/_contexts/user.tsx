import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

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

    // Placeholder for API-based session verification if needed in the future
    const checkSession = async (): Promise<boolean> => {
        const localStatus = localStorage.getItem("is_logged_in") === "true";
        if (!localStatus && isLoggedIn) {
            setIsLoggedIn(false);
        }
        return localStatus;
    };

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
