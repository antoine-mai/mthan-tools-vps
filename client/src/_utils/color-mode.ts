export type ColorMode = "dark" | "light";
export type ColorModePreference = ColorMode | "system";

const colorModeStorageKey = "vps-color-mode";

export function getSystemColorMode(): ColorMode {
    if (!window.matchMedia) {
        return "light";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

export function getStoredColorMode(): ColorMode | null {
    const storedColorMode = window.localStorage.getItem(colorModeStorageKey);

    if (storedColorMode === "dark" || storedColorMode === "light") {
        return storedColorMode;
    }

    return null;
}

export function getColorMode(): ColorMode {
    return getStoredColorMode() ?? getSystemColorMode();
}

export function applyColorMode(colorMode: ColorMode) {
    document.documentElement.classList.toggle("dark", colorMode === "dark");
    document.documentElement.style.colorScheme = colorMode;
}

export function setColorMode(colorMode: ColorMode) {
    window.localStorage.setItem(colorModeStorageKey, colorMode);
    applyColorMode(colorMode);
}

export function getColorModePreference(): ColorModePreference {
    return getStoredColorMode() ?? "system";
}

export function setColorModePreference(preference: ColorModePreference) {
    if (preference === "system") {
        window.localStorage.removeItem(colorModeStorageKey);
        applyColorMode(getSystemColorMode());
    } else {
        setColorMode(preference);
    }
    window.dispatchEvent(new Event("vps-color-mode-change"));
}

export function toggleColorMode(colorMode: ColorMode): ColorMode {
    const nextColorMode = colorMode === "dark" ? "light" : "dark";
    setColorMode(nextColorMode);
    return nextColorMode;
}

export function syncColorModeWithSystem() {
    if (getStoredColorMode() === null) {
        applyColorMode(getSystemColorMode());
    } else {
        applyColorMode(getColorMode());
    }
}
