import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { runtime } from "../runtime";

export type TerminalTab = { id: number; username?: string };

type TerminalContextType = {
    activeTabId: number;
    isOpen: boolean;
    tabs: TerminalTab[];
    addTab: (username?: string) => void;
    closePanel: () => void;
    closeTab: (id: number) => void;
    duplicateActiveTab: () => void;
    openRoot: () => void;
    setActiveTabId: (id: number) => void;
};

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export function TerminalProvider({ children }: { children: ReactNode }) {
    const [tabs, setTabs] = useState<TerminalTab[]>([{ id: 1 }]);
    const [activeTabId, setActiveTabId] = useState(1);
    const [isOpen, setIsOpen] = useState(false);

    const addTab = (username?: string) => {
        setTabs((current) => {
            const tab = { id: Math.max(0, ...current.map((item) => item.id)) + 1, username };
            setActiveTabId(tab.id);
            return [...current, tab];
        });
        setIsOpen(true);
    };

    const openRoot = () => {
        const rootTab = tabs.find((tab) => !tab.username);
        if (rootTab) setActiveTabId(rootTab.id);
        else addTab();
        setIsOpen(true);
    };

    const closeTab = (id: number) => {
        setTabs((current) => {
            if (current.length === 1) {
                setIsOpen(false);
                return current;
            }
            const index = current.findIndex((tab) => tab.id === id);
            const next = current.filter((tab) => tab.id !== id);
            if (activeTabId === id) setActiveTabId((next[Math.max(0, index - 1)] ?? next[0]).id);
            return next;
        });
    };

    const duplicateActiveTab = () => {
        addTab(tabs.find((tab) => tab.id === activeTabId)?.username);
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (runtime.isRoot && event.ctrlKey && event.key === "`") {
                event.preventDefault();
                setIsOpen((current) => !current);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <TerminalContext.Provider value={{ activeTabId, isOpen, tabs, addTab, closePanel: () => setIsOpen(false), closeTab, duplicateActiveTab, openRoot, setActiveTabId }}>
            {children}
        </TerminalContext.Provider>
    );
}

export function useTerminal() {
    const context = useContext(TerminalContext);
    if (!context) throw new Error("useTerminal must be used within TerminalProvider");
    return context;
}
