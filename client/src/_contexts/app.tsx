import { createContext, useContext, useState, type ReactNode } from "react";
import { runtime } from "../runtime";
import { getAppName, storeAppName } from "_utils/app-settings";

type AppContextType = {
    isRoot: boolean;
    mode: "root" | "user";
    env: string;
    appName: string;
    setAppName: (appName: string) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const [appName, setCurrentAppName] = useState(getAppName);

    const setAppName = (value: string) => {
        setCurrentAppName(storeAppName(value));
    };

    return (
        <AppContext.Provider
            value={{
                isRoot: runtime.isRoot,
                mode: runtime.mode,
                env: runtime.env,
                appName,
                setAppName,
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
