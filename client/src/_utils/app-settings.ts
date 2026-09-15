export const defaultAppName = "MTHAN VPS";

const appNameStorageKey = "vps-app-name";

export function getAppName() {
    const stored = window.localStorage.getItem(appNameStorageKey)?.trim();
    if (!stored || stored === "MThan VPS Panel" || stored === "MThan VPS") {
        return defaultAppName;
    }
    return stored;
}

export function storeAppName(appName: string) {
    const value = appName.trim() || defaultAppName;
    const finalValue = value === "MThan VPS Panel" || value === "MThan VPS" ? defaultAppName : value;
    window.localStorage.setItem(appNameStorageKey, finalValue);
    return finalValue;
}
