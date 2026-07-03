import { useEffect, useState } from "react";
import {
    Folder,
    File,
    ChevronRight,
    ChevronDown,
    FileText,
    Image,
    Music,
    Video,
    Archive,
    Home,
    Loader2,
    AlertCircle,
    RefreshCw,
    X,
    FolderOpen,
} from "lucide-react";

import DashboardLayout from "_layouts/dashboard";
import { Button } from "_layouts/_components/ui/button";
import { runtime } from "../../runtime";

interface FileItem {
    name: string;
    isDir: boolean;
    size: number;
    modTime: string;
    path: string;
}

interface DirectoryList {
    currentPath: string;
    parentPath: string;
    items: FileItem[];
}

const apiEndpoint = runtime.isRoot ? "/post/files" : "/api/files";

export default function FilesRoute() {
    const [homePath, setHomePath] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Tree Explorer state
    const [expanded, setExpanded] = useState<Record<string, FileItem[]>>({});
    const [openPaths, setOpenPaths] = useState<Record<string, boolean>>({});

    // Active File Viewer state
    const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
    const [fileContent, setFileContent] = useState<string>("");
    const [isBinary, setIsBinary] = useState(false);
    const [fileSize, setFileSize] = useState<number>(0);
    const [isContentLoading, setIsContentLoading] = useState(false);
    const [contentError, setContentError] = useState<string | null>(null);

    // Initialize root / home directory
    const initExplorer = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${apiEndpoint}?path=`);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "Failed to initialize root path");
            }
            const data: DirectoryList = await response.json();
            setHomePath(data.currentPath);

            // Fetch and set items for the root folder
            const items = await fetchFolderContents(data.currentPath);
            setExpanded((prev) => ({ ...prev, [data.currentPath]: items }));
            setOpenPaths((prev) => ({ ...prev, [data.currentPath]: true }));
        } catch (err: any) {
            setError(err.message || "Could not load file system.");
        } finally {
            setIsLoading(false);
        }
    };

    // Load folder contents (directories & files)
    const fetchFolderContents = async (path: string): Promise<FileItem[]> => {
        try {
            const response = await fetch(`${apiEndpoint}?path=${encodeURIComponent(path)}`);
            if (!response.ok) return [];
            const data: DirectoryList = await response.json();
            
            // Sort: directories first, then files
            return (data.items || []).sort((a, b) => {
                if (a.isDir && !b.isDir) return -1;
                if (!a.isDir && b.isDir) return 1;
                return a.name.localeCompare(b.name);
            });
        } catch {
            return [];
        }
    };

    const handleToggleExpand = async (path: string) => {
        const isOpen = openPaths[path] || false;
        
        if (!isOpen) {
            if (!expanded[path]) {
                const items = await fetchFolderContents(path);
                setExpanded((prev) => ({ ...prev, [path]: items }));
            }
            setOpenPaths((prev) => ({ ...prev, [path]: true }));
        } else {
            setOpenPaths((prev) => ({ ...prev, [path]: false }));
        }
    };

    const handleSelectNode = async (item: FileItem) => {
        if (item.isDir) {
            await handleToggleExpand(item.path);
        } else {
            // Load file content
            setSelectedFile(item);
            setIsContentLoading(true);
            setContentError(null);
            try {
                const response = await fetch(`${apiEndpoint}?path=${encodeURIComponent(item.path)}&content=true`);
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(text || "Failed to load file contents");
                }
                const data = await response.json();
                setFileContent(data.content || "");
                setIsBinary(data.isBinary || false);
                setFileSize(data.size || 0);
            } catch (err: any) {
                setContentError(err.message || "Failed to read file");
            } finally {
                setIsContentLoading(false);
            }
        }
    };

    useEffect(() => {
        initExplorer();
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    return (
        <DashboardLayout
            title="Files"
            description="Manage and edit configuration files exactly like VSCode."
            fullWidth={true}
        >
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] border border-border rounded-lg bg-card overflow-hidden h-[calc(100vh-220px)] shadow-lg">
                {/* 1. Left Explorer Sidebar (VSCode Explorer Style) */}
                <aside className="border-r border-border bg-card/60 flex flex-col h-full overflow-hidden select-none">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Explorer: VPS
                        </span>
                        <button
                            onClick={initExplorer}
                            className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Refresh Explorer"
                            disabled={isLoading}
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto py-2 px-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : error ? (
                            <div className="text-xs text-destructive p-3 text-center">
                                <AlertCircle className="h-5 w-5 mx-auto mb-2 text-destructive" />
                                <span>{error}</span>
                            </div>
                        ) : homePath ? (
                            <DirectoryTreeNode
                                path={homePath}
                                name="workspace"
                                isDir={true}
                                depth={0}
                                selectedPath={selectedFile?.path || ""}
                                onSelect={handleSelectNode}
                                expanded={expanded}
                                openPaths={openPaths}
                                onToggle={handleToggleExpand}
                            />
                        ) : null}
                    </div>
                </aside>

                {/* 2. Right Editor Pane (VSCode Tab/Editor Style) */}
                <main className="bg-slate-950 flex flex-col h-full overflow-hidden text-slate-200">
                    {selectedFile ? (
                        <>
                            {/* Editor Tab Bar */}
                            <div className="flex items-center border-b border-slate-800 bg-slate-900/60 select-none">
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 border-r border-slate-800 text-xs font-medium text-slate-200 relative">
                                    <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span>{selectedFile.name}</span>
                                    <button
                                        onClick={() => setSelectedFile(null)}
                                        className="ml-2 p-0.5 rounded text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                                <div className="flex-1" />
                                <div className="px-4 text-[10px] text-slate-500 font-mono">
                                    {formatBytes(fileSize)}
                                </div>
                            </div>

                            {/* Editor Content Area */}
                            <div className="flex-1 overflow-hidden relative">
                                {isContentLoading ? (
                                    <div className="flex h-full items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                                    </div>
                                ) : contentError ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-2 text-red-400 p-6 text-center select-none">
                                        <AlertCircle className="h-8 w-8 shrink-0" />
                                        <p className="text-sm font-semibold">{contentError}</p>
                                    </div>
                                ) : isBinary ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 select-none">
                                        <AlertCircle className="h-10 w-10 mb-3 text-amber-600 animate-pulse" />
                                        <p className="text-sm font-semibold text-slate-300">Binary file not displayed</p>
                                        <p className="text-xs mt-1 max-w-sm text-center leading-relaxed">
                                            This file is not displayed in the text editor because it is either binary, has an unsupported text encoding, or is too large.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex font-mono text-xs md:text-sm leading-6 overflow-auto h-full bg-slate-950 text-slate-300">
                                        {/* Line numbers */}
                                        <div className="text-right pr-4 pl-3 select-none text-slate-600 border-r border-slate-800 bg-slate-900/20 sticky left-0 min-w-[3.5rem] py-4">
                                            {fileContent.split("\n").map((_, idx) => (
                                                <div key={idx} className="h-6">{idx + 1}</div>
                                            ))}
                                        </div>
                                        {/* File body content */}
                                        <pre className="pl-4 pr-6 py-4 m-0 select-text whitespace-pre overflow-visible flex-1 leading-6">
                                            {fileContent}
                                        </pre>
                                    </div>
                                )}
                            </div>

                            {/* Editor Status Bar */}
                            <div className="border-t border-slate-900 bg-slate-900 px-4 py-1.5 flex items-center justify-between text-[10px] text-slate-500 font-mono select-none">
                                <span className="truncate max-w-md" title={selectedFile.path}>
                                    Path: {selectedFile.path}
                                </span>
                                <span>UTF-8</span>
                            </div>
                        </>
                    ) : (
                        /* VSCode Empty Welcome Screen */
                        <div className="flex-1 flex flex-col items-center justify-center p-8 select-none bg-slate-950 text-slate-500">
                            <div className="flex flex-col items-center max-w-md text-center gap-6">
                                <div className="h-16 w-16 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 flex text-slate-400">
                                    <FolderOpen className="h-8 w-8" />
                                </div>
                                <div className="space-y-1.5">
                                    <h3 className="text-slate-300 font-semibold text-sm">MThan VPS Editor</h3>
                                    <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
                                        Select a configuration file or script from the directory tree sidebar to view or edit its contents.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </DashboardLayout>
    );
}

// Tree view Node component helper (directories & files mixed)
interface DirectoryTreeNodeProps {
    path: string;
    name: string;
    isDir: boolean;
    depth: number;
    selectedPath: string;
    onSelect: (item: FileItem) => void;
    expanded: Record<string, FileItem[]>;
    openPaths: Record<string, boolean>;
    onToggle: (path: string) => Promise<void>;
}

function DirectoryTreeNode({
    path,
    name,
    isDir,
    depth,
    selectedPath,
    onSelect,
    expanded,
    openPaths,
    onToggle,
}: DirectoryTreeNodeProps) {
    const isExpanded = openPaths[path] || false;
    const isSelected = selectedPath === path;
    const children = expanded[path] || [];

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDir) {
            await onToggle(path);
        }
    };

    const handleClick = () => {
        onSelect({ name, isDir, path, size: 0, modTime: "" });
    };

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer hover:bg-muted/60 transition-colors text-xs ${
                    isSelected ? "bg-primary/10 text-primary font-medium" : "text-foreground/90"
                }`}
                style={{ paddingLeft: `${depth * 10 + 8}px` }}
                onClick={handleClick}
            >
                {isDir ? (
                    <button
                        onClick={handleToggle}
                        className="p-0.5 rounded hover:bg-muted-foreground/10 text-muted-foreground shrink-0"
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                        ) : (
                            <ChevronRight className="h-3 w-3" />
                        )}
                    </button>
                ) : (
                    // File spacer to align with folders
                    <div className="w-4 h-4 shrink-0" />
                )}
                {isDir ? (
                    <Folder className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary fill-primary/10" : "text-muted-foreground"}`} />
                ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
                <span className="truncate flex-1 min-w-0">{name}</span>
            </div>

            {isDir && isExpanded && children.length > 0 && (
                <div className="mt-0.5">
                    {children.map((item) => (
                        <DirectoryTreeNode
                            key={item.path}
                            path={item.path}
                            name={item.name}
                            isDir={item.isDir}
                            depth={depth + 1}
                            selectedPath={selectedPath}
                            onSelect={onSelect}
                            expanded={expanded}
                            openPaths={openPaths}
                            onToggle={onToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
