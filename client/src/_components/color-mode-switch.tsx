import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import {
    applyColorMode,
    type ColorMode,
    getColorMode,
    getStoredColorMode,
    getSystemColorMode,
    toggleColorMode,
} from "_utils/color-mode";

export default function ColorModeSwitch() {
    const [colorMode, setCurrentColorMode] = useState<ColorMode>(getColorMode);

    useEffect(() => {
        applyColorMode(colorMode);
    }, [colorMode]);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        const handlePreferenceChange = () => setCurrentColorMode(getColorMode());

        function handleSystemColorModeChange() {
            if (getStoredColorMode() === null) {
                setCurrentColorMode(getSystemColorMode());
            }
        }

        mediaQuery.addEventListener("change", handleSystemColorModeChange);
        window.addEventListener("vps-color-mode-change", handlePreferenceChange);

        return () => {
            mediaQuery.removeEventListener(
                "change",
                handleSystemColorModeChange,
            );
            window.removeEventListener("vps-color-mode-change", handlePreferenceChange);
        };
    }, []);

    const nextColorMode = colorMode === "dark" ? "light" : "dark";

    return (
        <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            type="button"
            aria-label={`Switch to ${nextColorMode} mode`}
            title={`Switch to ${nextColorMode} mode`}
            onClick={() => setCurrentColorMode(toggleColorMode(colorMode))}
        >
            {colorMode === "dark" ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
            )}
        </button>
    );
}
