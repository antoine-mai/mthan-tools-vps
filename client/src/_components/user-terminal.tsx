import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { Terminal as TerminalIcon, RefreshCw, Trash2 } from "lucide-react";
import "xterm/css/xterm.css";

import { runtime } from "runtime";
import { Button } from "_layouts/_components/ui/button";
import {
    useResolvedColorMode,
    readDocumentColorMode,
    terminalTheme,
} from "./terminal-panel";

interface UserTerminalProps {
    username: string;
}

export default function UserTerminal({ username }: UserTerminalProps) {
    const colorMode = useResolvedColorMode();
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<HTMLDivElement>(null);
    const termInstance = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
    const [connectKey, setConnectKey] = useState(0);

    const handleRestart = () => {
        setConnectKey((prev) => prev + 1);
    };

    const handleClear = () => {
        termInstance.current?.clear();
        termInstance.current?.focus();
    };

    useEffect(() => {
        if (!terminalRef.current) return;

        const theme = terminalTheme(readDocumentColorMode());
        const term = new Terminal({
            cursorBlink: true,
            theme,
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: 13,
            scrollback: 5000,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);

        termInstance.current = term;
        fitAddonRef.current = fitAddon;

        let disposed = false;
        let reconnectTimer: number | undefined;
        let heartbeatTimer: number | undefined;

        const connect = (reconnecting = false) => {
            setStatus("connecting");
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const userQuery = runtime.isRoot && username ? `?user=${encodeURIComponent(username)}` : "";
            const endpoint = runtime.isRoot ? "/post/terminal" : "/api/terminal";
            const wsUrl = `${protocol}//${window.location.host}${endpoint}${userQuery}`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                if (disposed) return;
                setStatus("connected");
                if (reconnecting) {
                    term.write("\r\n\x1b[32mTerminal reconnected. A new shell session was started.\x1b[0m\r\n");
                }
                resizeTerminal();
                window.clearInterval(heartbeatTimer);
                heartbeatTimer = window.setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: "ping" }));
                    }
                }, 20000);
            };

            ws.onmessage = (event) => term.write(event.data);
            ws.onerror = () => {
                if (!disposed) setStatus("disconnected");
                ws.close();
            };
            ws.onclose = () => {
                window.clearInterval(heartbeatTimer);
                if (disposed || wsRef.current !== ws) return;
                setStatus("disconnected");
                term.write("\r\n\x1b[33mConnection closed. Reconnecting…\x1b[0m\r\n");
                reconnectTimer = window.setTimeout(() => connect(true), 2000);
            };
        };

        connect();

        const dataDisposable = term.onData((data) => {
            const ws = wsRef.current;
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "input", data }));
            }
        });

        function resizeTerminal() {
            try {
                fitAddon.fit();
                const ws = wsRef.current;
                if (ws?.readyState === WebSocket.OPEN) {
                    ws.send(
                        JSON.stringify({
                            type: "resize",
                            cols: term.cols,
                            rows: term.rows,
                        })
                    );
                }
            } catch (error) {
                // ignore
            }
        }

        const resizeObserver = new ResizeObserver(() => {
            resizeTerminal();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        const initialFit = window.setTimeout(() => {
            resizeTerminal();
            term.focus();
        }, 100);

        return () => {
            disposed = true;
            window.clearTimeout(initialFit);
            window.clearTimeout(reconnectTimer);
            window.clearInterval(heartbeatTimer);
            resizeObserver.disconnect();
            dataDisposable.dispose();
            wsRef.current?.close();
            term.dispose();
        };
    }, [username, connectKey]);

    useEffect(() => {
        const term = termInstance.current;
        if (!term) return;
        term.options.theme = terminalTheme(colorMode);
    }, [colorMode]);

    return (
        <div
            ref={containerRef}
            className="flex h-full w-full flex-col overflow-hidden bg-background"
        >
            {/* Terminal Header Bar */}
            <div className="flex h-10 items-center justify-between border-b border-border bg-muted/40 px-4 select-none shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <TerminalIcon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs font-semibold text-foreground truncate">
                        {username}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                        (Interactive Shell)
                    </span>

                    {/* Status badge */}
                    {status === "connected" ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Connected
                        </span>
                    ) : status === "connecting" ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                            Connecting...
                        </span>
                    ) : (
                        <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-destructive">
                            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                            Disconnected
                        </span>
                    )}
                </div>

                {/* Toolbar Controls */}
                <div className="flex items-center gap-1.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={handleClear}
                        title="Clear terminal buffer"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={handleRestart}
                        title="Restart shell session"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Restart
                    </Button>
                </div>
            </div>

            {/* XTerm Screen Container */}
            <div
                className="flex-1 min-h-0 w-full overflow-hidden p-3 relative"
                style={{ backgroundColor: terminalTheme(colorMode).background }}
                onClick={() => termInstance.current?.focus()}
            >
                <div ref={terminalRef} className="h-full w-full" />
            </div>
        </div>
    );
}
