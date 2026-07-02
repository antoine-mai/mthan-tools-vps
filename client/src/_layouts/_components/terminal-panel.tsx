import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { Plus, X, Terminal as TerminalIcon } from "lucide-react";
import "xterm/css/xterm.css";

import type { ColorMode } from "_utils/color-mode";

type TerminalPanelProps = {
    onClose: () => void;
};

type TerminalTab = {
    id: number;
    title: string;
};

const initialTab: TerminalTab = { id: 1, title: "bash" };

export default function TerminalPanel({ onClose }: TerminalPanelProps) {
    const [tabs, setTabs] = useState<TerminalTab[]>([initialTab]);
    const [activeTabId, setActiveTabId] = useState(initialTab.id);
    const colorMode = useResolvedColorMode();

    function addTab() {
        setTabs((currentTabs) => {
            const nextId = Math.max(...currentTabs.map((tab) => tab.id), 0) + 1;
            const nextTab = {
                id: nextId,
                title: `bash ${nextId}`,
            };
            setActiveTabId(nextTab.id);
            return [...currentTabs, nextTab];
        });
    }

    function closeTab(tabId: number) {
        if (tabs.length === 1) {
            onClose();
            return;
        }

        const tabIndex = tabs.findIndex((tab) => tab.id === tabId);
        const nextTabs = tabs.filter((tab) => tab.id !== tabId);
        setTabs(nextTabs);

        if (activeTabId === tabId) {
            const nextActiveTab =
                nextTabs[Math.max(0, tabIndex - 1)] ?? nextTabs[0];
            setActiveTabId(nextActiveTab.id);
        }
    }

    return (
        <div className="z-30 flex h-[320px] w-full flex-col border-t border-border bg-background text-foreground">
            <div className="flex h-9 items-center justify-between border-b border-border bg-muted/40 select-none">
                <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
                    <div className="flex h-9 items-center border-r border-border px-3 text-xs font-semibold text-muted-foreground">
                        <TerminalIcon className="h-3.5 w-3.5" />
                    </div>

                    {tabs.map((tab) => {
                        const isActive = tab.id === activeTabId;

                        return (
                            <div
                                key={tab.id}
                                className={`group flex h-9 max-w-44 items-center border-r border-border text-xs transition-colors ${
                                    isActive
                                        ? "bg-background text-foreground"
                                        : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                            >
                                <button
                                    className="min-w-0 flex-1 px-3 text-left"
                                    type="button"
                                    onClick={() => setActiveTabId(tab.id)}
                                    title={tab.title}
                                >
                                    <span className="block truncate">{tab.title}</span>
                                </button>
                                <button
                                    className="mr-2 rounded p-0.5 text-muted-foreground opacity-70 hover:bg-muted-foreground/15 hover:text-foreground group-hover:opacity-100"
                                    type="button"
                                    title="Close terminal"
                                    onClick={() => closeTab(tab.id)}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        );
                    })}

                    <button
                        className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        type="button"
                        title="New terminal"
                        onClick={addTab}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                </div>

                <button
                    onClick={onClose}
                    className="mr-2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Close panel"
                    type="button"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="relative flex-1 overflow-hidden">
                {tabs.map((tab) => (
                    <TerminalSession
                        key={tab.id}
                        active={tab.id === activeTabId}
                        colorMode={colorMode}
                    />
                ))}
            </div>
        </div>
    );
}

function TerminalSession({
    active,
    colorMode,
}: {
    active: boolean;
    colorMode: ColorMode;
}) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const termInstance = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            theme: terminalTheme(readDocumentColorMode()),
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: 13,
            scrollback: 5000,
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);

        termInstance.current = term;
        fitAddonRef.current = fitAddon;

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/post/terminal`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            term.write("\r\n*** Connected to VPS Terminal (Root) ***\r\n\r\n");
            resizeTerminal();
        };

        ws.onmessage = (event) => {
            term.write(event.data);
        };

        ws.onerror = () => {
            term.write("\r\n*** Terminal connection error ***\r\n");
        };

        ws.onclose = () => {
            term.write("\r\n*** Terminal connection closed ***\r\n");
        };

        const dataDisposable = term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "input", data }));
            }
        });

        const handleResize = () => resizeTerminal();
        window.addEventListener("resize", handleResize);

        const initialFit = window.setTimeout(() => resizeTerminal(), 50);

        function resizeTerminal() {
            try {
                fitAddon.fit();
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(
                        JSON.stringify({
                            type: "resize",
                            cols: term.cols,
                            rows: term.rows,
                        }),
                    );
                }
            } catch (error) {
                console.error("Terminal fit error", error);
            }
        }

        return () => {
            window.clearTimeout(initialFit);
            window.removeEventListener("resize", handleResize);
            dataDisposable.dispose();
            ws.close();
            term.dispose();
        };
    }, []);

    useEffect(() => {
        const term = termInstance.current;
        if (!term) return;

        term.options.theme = terminalTheme(colorMode);
    }, [colorMode]);

    useEffect(() => {
        if (!active) return;

        window.setTimeout(() => {
            try {
                fitAddonRef.current?.fit();
                termInstance.current?.focus();
            } catch (error) {
                console.error("Terminal activate error", error);
            }
        }, 0);
    }, [active]);

    return (
        <div
            className={`absolute inset-0 p-2 ${active ? "block" : "hidden"}`}
            style={{ backgroundColor: terminalTheme(colorMode).background }}
        >
            <div ref={terminalRef} className="h-full w-full" />
        </div>
    );
}

function useResolvedColorMode(): ColorMode {
    const [colorMode, setColorMode] = useState<ColorMode>(readDocumentColorMode);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setColorMode(
                document.documentElement.classList.contains("dark")
                    ? "dark"
                    : "light",
            );
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

    return colorMode;
}

function readDocumentColorMode(): ColorMode {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function terminalTheme(colorMode: ColorMode) {
    if (colorMode === "light") {
        return {
            background: "#ffffff",
            foreground: "#1f2328",
            cursor: "#1f2328",
            selectionBackground: "#b6d7ff",
            black: "#24292f",
            red: "#cf222e",
            green: "#116329",
            yellow: "#4d2d00",
            blue: "#0969da",
            magenta: "#8250df",
            cyan: "#1b7c83",
            white: "#6e7781",
            brightBlack: "#57606a",
            brightRed: "#a40e26",
            brightGreen: "#1a7f37",
            brightYellow: "#633c01",
            brightBlue: "#0550ae",
            brightMagenta: "#6639ba",
            brightCyan: "#0a6b73",
            brightWhite: "#24292f",
        };
    }

    return {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#ffffff",
        selectionBackground: "#264f78",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
    };
}
