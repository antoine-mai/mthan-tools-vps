import { createContext, useContext, type ReactNode } from "react";
import { runtime } from "../runtime";

type AppContextType = {
    isRoot: boolean;
    mode: "root" | "user";
    env: string;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    return (
        <AppContext.Provider
            value={{
                isRoot: runtime.isRoot,
                mode: runtime.mode,
                env: runtime.env,
            }}
        >
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error("useApp must be used within an AppProvider");
    }
    return context;
}
