import React, { useEffect, useRef, useState } from "react";
import {
    FileText,
    X,
    Loader2,
    AlertCircle,
    FolderOpen,
    Save,
    Check,
    WrapText,
    Undo2,
} from "lucide-react";
import { Button } from "_layouts/_components/ui/button";

interface FileEditorProps {
    fileName: string;
    filePath: string;
    fileSize: number;
    content: string;
    isBinary: boolean;
    isLoading: boolean;
    error: string | null;
    onClose?: () => void;
    onSave?: (newContent: string) => Promise<void>;
    placeholderTitle?: string;
    placeholderDescription?: string;
}

export default function FileEditor({
    fileName,
    filePath,
    fileSize,
    content,
    isBinary,
    isLoading,
    error,
    onClose,
    onSave,
    placeholderTitle = "MThan VPS Editor",
    placeholderDescription = "Select a configuration file or script from the directory tree sidebar to view or edit its contents.",
}: FileEditorProps) {
    const [localContent, setLocalContent] = useState<string>(content);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [wordWrap, setWordWrap] = useState(false);
    const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

    const gutterRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Keep localContent in sync when active file or upstream content changes
    useEffect(() => {
        setLocalContent(content);
        setSaveError(null);
        setSaveSuccess(false);
        setCursorPos({ line: 1, col: 1 });
    }, [filePath, content]);

    const isDirty = !isLoading && !error && !isBinary && localContent !== content;

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (gutterRef.current) {
            gutterRef.current.scrollTop = e.currentTarget.scrollTop;
        }
    };

    const updateCursorPosition = (textarea: HTMLTextAreaElement) => {
        const textBefore = textarea.value.slice(0, textarea.selectionStart);
        const lines = textBefore.split("\n");
        setCursorPos({
            line: lines.length,
            col: lines[lines.length - 1].length + 1,
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Ctrl+S / Cmd+S -> Save
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            if (isDirty && !isSaving && onSave) {
                void handleSave();
            }
            return;
        }

        // Tab key support
        if (e.key === "Tab") {
            e.preventDefault();
            const textarea = e.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const tabSpaces = "  "; // 2 spaces

            if (e.shiftKey) {
                // Shift+Tab -> unindent current line
                const lineStart = localContent.lastIndexOf("\n", start - 1) + 1;
                if (localContent.substring(lineStart, lineStart + 2) === "  ") {
                    const updated = localContent.slice(0, lineStart) + localContent.slice(lineStart + 2);
                    setLocalContent(updated);
                    requestAnimationFrame(() => {
                        textarea.selectionStart = Math.max(lineStart, start - 2);
                        textarea.selectionEnd = Math.max(lineStart, end - 2);
                        updateCursorPosition(textarea);
                    });
                }
            } else {
                // Normal Tab -> insert spaces
                const updated = localContent.substring(0, start) + tabSpaces + localContent.substring(end);
                setLocalContent(updated);
                requestAnimationFrame(() => {
                    textarea.selectionStart = textarea.selectionEnd = start + tabSpaces.length;
                    updateCursorPosition(textarea);
                });
            }
        }
    };

    const handleSave = async () => {
        if (!onSave || isSaving || !isDirty) return;
        setIsSaving(true);
        setSaveError(null);
        try {
            await onSave(localContent);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2500);
        } catch (err: any) {
            setSaveError(err.message || "Failed to save file");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRevert = () => {
        if (window.confirm("Discard all unsaved changes to this file?")) {
            setLocalContent(content);
            setSaveError(null);
        }
    };

    const handleClose = () => {
        if (isDirty) {
            if (!window.confirm("You have unsaved changes. Are you sure you want to close?")) {
                return;
            }
        }
        onClose?.();
    };

    if (!fileName && !filePath) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 select-none bg-background text-muted-foreground">
                <div className="flex flex-col items-center max-w-md text-center gap-6">
                    <div className="h-16 w-16 items-center justify-center rounded-xl bg-muted border border-border flex text-muted-foreground">
                        <FolderOpen className="h-8 w-8" />
                    </div>
                    <div className="space-y-1.5">
                        <h3 className="text-foreground font-semibold text-sm">{placeholderTitle}</h3>
                        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                            {placeholderDescription}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const linesArray = localContent.split("\n");
    const totalLines = linesArray.length;

    return (
        <div className="flex-grow flex flex-col h-full overflow-hidden text-foreground bg-background">
            {/* Editor Tab Bar & Controls */}
            <div className="flex h-10 items-center justify-between border-b border-border bg-muted/40 select-none shrink-0 px-2">
                <div className="flex h-full items-center">
                    <div className="flex h-full items-center gap-2 px-3 bg-background border-r border-border text-xs font-medium text-foreground relative">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[200px]" title={fileName}>{fileName}</span>
                        {isDirty && (
                            <span
                                className="h-2 w-2 rounded-full bg-amber-500 shrink-0"
                                title="Unsaved changes"
                            />
                        )}
                        {onClose && (
                            <button
                                onClick={handleClose}
                                className="ml-1.5 p-0.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                title="Close file"
                                aria-label="Close file"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Action Toolbar */}
                <div className="flex items-center gap-2">
                    {saveSuccess && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <Check className="h-3.5 w-3.5" />
                            Saved
                        </span>
                    )}
                    {isDirty && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                            Unsaved changes
                        </span>
                    )}

                    {/* Word wrap toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 text-muted-foreground hover:text-foreground ${wordWrap ? "bg-muted text-foreground" : ""}`}
                        onClick={() => setWordWrap(!wordWrap)}
                        title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
                        aria-label="Toggle word wrap"
                    >
                        <WrapText className="h-3.5 w-3.5" />
                    </Button>

                    {/* Discard unsaved changes */}
                    {isDirty && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
                            onClick={handleRevert}
                            title="Discard unsaved changes"
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                            Discard
                        </Button>
                    )}

                    {/* Save Button */}
                    {onSave && (
                        <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1.5 shadow-sm"
                            onClick={() => void handleSave()}
                            disabled={isSaving || !isDirty || isBinary || isLoading}
                        >
                            {isSaving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Save className="h-3.5 w-3.5" />
                            )}
                            <span>Save</span>
                            <kbd className="ml-1 hidden sm:inline-block rounded bg-primary-foreground/20 px-1 py-0.5 text-[9px] font-mono">
                                Ctrl+S
                            </kbd>
                        </Button>
                    )}
                </div>
            </div>

            {/* Error banner if save fails */}
            {saveError && (
                <div className="flex items-center justify-between border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive shrink-0">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{saveError}</span>
                    </div>
                    <button
                        onClick={() => setSaveError(null)}
                        className="p-0.5 rounded hover:bg-destructive/20"
                        title="Dismiss"
                        aria-label="Dismiss error"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}

            {/* Editor Body */}
            <div className="flex-1 overflow-hidden relative">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center bg-background">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive p-6 text-center select-none bg-background">
                        <AlertCircle className="h-8 w-8 shrink-0" />
                        <p className="text-sm font-semibold">{error}</p>
                    </div>
                ) : isBinary ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 select-none bg-background">
                        <AlertCircle className="h-10 w-10 mb-3 text-amber-600 animate-pulse" />
                        <p className="text-sm font-semibold text-foreground">Binary file not displayed</p>
                        <p className="text-xs mt-1 max-w-sm text-center leading-relaxed">
                            This file cannot be displayed or edited in the text editor because it contains binary data.
                        </p>
                    </div>
                ) : (
                    <div className="flex h-full bg-background overflow-hidden relative">
                        {/* Line numbers gutter */}
                        <div
                            ref={gutterRef}
                            className="text-right pr-3 pl-3 select-none text-muted-foreground/60 border-r border-border bg-muted/20 overflow-hidden font-mono text-xs leading-6 py-3 shrink-0 pointer-events-none min-w-[3.25rem]"
                            aria-hidden="true"
                        >
                            {linesArray.map((_, idx) => (
                                <div key={idx} className="h-6">
                                    {idx + 1}
                                </div>
                            ))}
                        </div>

                        {/* Interactive Textarea Code Editor */}
                        <textarea
                            ref={textareaRef}
                            value={localContent}
                            onChange={(e) => setLocalContent(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onScroll={handleScroll}
                            onSelect={(e) => updateCursorPosition(e.currentTarget)}
                            onClick={(e) => updateCursorPosition(e.currentTarget)}
                            onKeyUp={(e) => updateCursorPosition(e.currentTarget)}
                            wrap={wordWrap ? "soft" : "off"}
                            spellCheck={false}
                            autoCapitalize="off"
                            autoComplete="off"
                            autoCorrect="off"
                            className="flex-1 h-full w-full resize-none bg-background p-3 font-mono text-xs leading-6 text-foreground outline-none border-0 overflow-auto"
                            aria-label={`Editor for ${fileName}`}
                        />
                    </div>
                )}
            </div>

            {/* Editor Status Bar */}
            <div className="border-t border-border bg-muted/50 px-4 py-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono select-none shrink-0">
                <span className="truncate max-w-md" title={filePath}>
                    Path: {filePath}
                </span>
                <div className="flex items-center gap-4">
                    <span>
                        Ln {cursorPos.line}, Col {cursorPos.col}
                    </span>
                    <span>{totalLines} lines</span>
                    <span>{formatBytes(fileSize || localContent.length)}</span>
                    <span>UTF-8</span>
                </div>
            </div>
        </div>
    );
}
