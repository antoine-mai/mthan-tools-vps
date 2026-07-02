import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { X, Terminal as TerminalIcon } from "lucide-react";
import "xterm/css/xterm.css";

import { runtime } from "../../runtime";

type TerminalPanelProps = {
    onClose: () => void;
};

export default function TerminalPanel({ onClose }: TerminalPanelProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const termInstance = useRef<Terminal | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        // 1. Initialize Xterm
        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: "#1e1e1e",
                foreground: "#d4d4d4",
                cursor: "#ffffff",
                black: "#000000",
                red: "#cd3131",
                green: "#0dbc79",
                yellow: "#e5e510",
                blue: "#2472c8",
                magenta: "#bc3fbc",
                cyan: "#11a8cd",
                white: "#e5e5e5",
            },
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: 13,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        termInstance.current = term;

        // Add a small delay to ensure container is fully painted before fitting
        setTimeout(() => {
            try {
                fitAddon.fit();
            } catch (e) {
                console.error("Fit error on mount", e);
            }
        }, 50);

        // 2. Connect WebSocket
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const endpoint = "/post/terminal"; // Terminal is only for root (under /post)
        const wsUrl = `${protocol}//${window.location.host}${endpoint}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            term.write("\r\n*** Connected to VPS Terminal (Root) ***\r\n\r\n");
            // Send initial size
            ws.send(
                JSON.stringify({
                    type: "resize",
                    cols: term.cols,
                    rows: term.rows,
                })
            );
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

        // Send data
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                    JSON.stringify({
                        type: "input",
                        data: data,
                    })
                );
            }
        });

        // Resize handler
        const handleResize = () => {
            try {
                fitAddon.fit();
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(
                        JSON.stringify({
                            type: "resize",
                            cols: term.cols,
                            rows: term.rows,
                        })
                    );
                }
            } catch (e) {
                console.error("Resize fit error", e);
            }
        };

        window.addEventListener("resize", handleResize);

        // Clean up
        return () => {
            window.removeEventListener("resize", handleResize);
            ws.close();
            term.dispose();
        };
    }, []);

    return (
        <div className="h-[280px] w-full border-t border-border bg-[#1e1e1e] text-foreground flex flex-col z-30">
            {/* Terminal Header */}
            <div className="flex h-9 items-center justify-between border-b border-[#2d2d2d] bg-[#252526] px-4 select-none">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <TerminalIcon className="h-3.5 w-3.5" />
                    <span>Terminal</span>
                </div>
                <button
                    onClick={onClose}
                    className="rounded p-1 text-muted-foreground hover:bg-[#37373d] hover:text-foreground transition-colors"
                    title="Close Panel"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Terminal Container */}
            <div className="flex-1 overflow-hidden p-2">
                <div ref={terminalRef} className="h-full w-full" />
            </div>
        </div>
    );
}
