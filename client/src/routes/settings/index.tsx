import { useEffect, useState } from "react";
import { Settings } from "lucide-react";

import { useApp } from "_contexts/app";
import DashboardLayout from "_layouts/dashboard";
import { defaultAppName } from "_utils/app-settings";
import {
    getColorModePreference,
    setColorModePreference,
    type ColorModePreference,
} from "_utils/color-mode";

export default function SettingsRoute() {
    const { appName, setAppName } = useApp();
    const [appNameDraft, setAppNameDraft] = useState(appName);
    const [colorMode, setCurrentColorMode] = useState<ColorModePreference>(getColorModePreference);

    useEffect(() => {
        const syncColorMode = () => setCurrentColorMode(getColorModePreference());
        window.addEventListener("vps-color-mode-change", syncColorMode);
        return () => window.removeEventListener("vps-color-mode-change", syncColorMode);
    }, []);

    const saveAppName = () => {
        const value = appNameDraft.trim() || defaultAppName;
        setAppName(value);
        setAppNameDraft(value);
    };

    const changeColorMode = (preference: ColorModePreference) => {
        setCurrentColorMode(preference);
        setColorModePreference(preference);
    };

    return (
        <DashboardLayout title="Settings" fullWidth>
            <div className="grid h-full grid-cols-1 overflow-hidden md:grid-cols-[240px_1fr]">
                <aside className="flex h-full flex-col border-r border-border bg-card/60 p-2">
                    <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                        <Settings className="h-4 w-4" />
                        General Settings
                    </div>
                </aside>

                <main className="overflow-y-auto p-6">
                    <div className="mx-auto max-w-2xl space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold">General Settings</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Configure the panel identity and appearance.</p>
                        </div>

                        <div className="divide-y divide-border rounded-md border border-border bg-card">
                            <div className="grid gap-3 p-4 sm:grid-cols-[180px_1fr] sm:items-center">
                                <label htmlFor="app-name" className="text-sm font-medium">App Name</label>
                                <input
                                    id="app-name"
                                    value={appNameDraft}
                                    onChange={(event) => setAppNameDraft(event.target.value)}
                                    onBlur={saveAppName}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") event.currentTarget.blur();
                                    }}
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                                />
                            </div>

                            <div className="grid gap-3 p-4 sm:grid-cols-[180px_1fr] sm:items-center">
                                <label htmlFor="color-mode" className="text-sm font-medium">Default Color Mode</label>
                                <select
                                    id="color-mode"
                                    value={colorMode}
                                    onChange={(event) => changeColorMode(event.target.value as ColorModePreference)}
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                                >
                                    <option value="system">System</option>
                                    <option value="light">Light</option>
                                    <option value="dark">Dark</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </DashboardLayout>
    );
}
