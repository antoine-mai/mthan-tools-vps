import {
    FileText,
    X,
    Loader2,
    AlertCircle,
    FolderOpen,
} from "lucide-react";

interface FileEditorProps {
    fileName: string;
    filePath: string;
    fileSize: number;
    content: string;
    isBinary: boolean;
    isLoading: boolean;
    error: string | null;
    onClose?: () => void;
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
    placeholderTitle = "MThan VPS Editor",
    placeholderDescription = "Select a configuration file or script from the directory tree sidebar to view or edit its contents.",
}: FileEditorProps) {
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    if (!fileName && !filePath) {
        return (
            /* VSCode Empty Welcome Screen */
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

    return (
        <div className="flex-grow flex flex-col h-full overflow-hidden text-foreground bg-background">
            {/* Editor Tab Bar */}
            <div className="flex h-10 items-center border-b border-border bg-muted/40 select-none shrink-0">
                <div className="flex h-full items-center gap-2 px-3 bg-background border-r border-border text-xs font-medium text-foreground relative">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{fileName}</span>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="ml-2 p-0.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
                <div className="flex-1" />
                <div className="px-4 text-[10px] text-muted-foreground font-mono">
                    {formatBytes(fileSize)}
                </div>
            </div>

            {/* Editor Content Area */}
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
                            This file is not displayed in the text editor because it is either binary, has an unsupported text encoding, or is too large.
                        </p>
                    </div>
                ) : (
                    <div className="flex font-mono text-xs md:text-sm leading-6 overflow-auto h-full bg-background text-foreground">
                        {/* Line numbers */}
                        <div className="text-right pr-4 pl-3 select-none text-muted-foreground border-r border-border bg-muted/30 sticky left-0 min-w-[3.5rem] py-4 shrink-0">
                            {content.split("\n").map((_, idx) => (
                                <div key={idx} className="h-6">{idx + 1}</div>
                            ))}
                        </div>
                        {/* File body content */}
                        <pre className="pl-4 pr-6 py-4 m-0 select-text whitespace-pre overflow-visible flex-1 leading-6">
                            {content}
                        </pre>
                    </div>
                )}
            </div>

            {/* Editor Status Bar */}
            <div className="border-t border-border bg-muted/50 px-4 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground font-mono select-none shrink-0">
                <span className="truncate max-w-md" title={filePath}>
                    Path: {filePath}
                </span>
                <span>UTF-8</span>
            </div>
        </div>
    );
}
