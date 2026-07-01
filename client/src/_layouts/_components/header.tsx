import ColorModeSwitch from "_components/color-mode-switch";
import { User, Menu } from "lucide-react";
import { useApp } from "../../_contexts/app";

type HeaderProps = {
    title: string;
    onMenuClick?: () => void;
};

export default function Header({ title, onMenuClick }: HeaderProps) {
    const { mode } = useApp();

    return (
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
            <div className="flex items-center gap-4">
                {onMenuClick && (
                    <button
                        onClick={onMenuClick}
                        className="rounded-md p-1.5 hover:bg-muted md:hidden"
                        aria-label="Toggle menu"
                    >
                        <Menu className="h-5 w-5 text-muted-foreground" />
                    </button>
                )}
                <h1 className="text-sm font-semibold text-foreground md:text-base">
                    {title}
                </h1>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="capitalize">{mode} session</span>
                </div>
                <ColorModeSwitch />
            </div>
        </header>
    );
}
