import { useEffect } from "react";
import { MagiSelect } from "@/components/ui/MagiSelect";
import { enable, disable } from "@tauri-apps/plugin-autostart";

import { ThemeMode, useSettingsStore } from "@/stores/settingsStore";
import { SettingRow, SettingToggle } from "../SettingsShared";

export function GeneralPanel() {
    const settings = useSettingsStore((state) => state.settings);
    const setSettings = useSettingsStore((state) => state.setSettings);
    const saveSettings = useSettingsStore((state) => state.saveSettings);

    useEffect(() => {
        if (settings.startAtLogin) {
            void enable();
        } else {
            void disable();
        }
    }, [settings.startAtLogin]);

    return (
        <div className="space-y-6">
            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Startup behavior
                </h3>
                <div className="space-y-3">
                    <SettingToggle
                        title="Launch on Login"
                        description="Start Dispatch automatically when you log in"
                        checked={settings.startAtLogin}
                        onChange={async (checked) => {
                            setSettings({ startAtLogin: checked });
                            if (checked) {
                                await enable();
                            } else {
                                await disable();
                            }
                            void saveSettings();
                        }}
                    />
                    <SettingToggle
                        title="Run in Background"
                        description="Keep watchers active when window is closed"
                        checked={settings.minimizeToTray}
                        onChange={(checked) => {
                            setSettings({ minimizeToTray: checked });
                            void saveSettings();
                        }}
                        highlight
                    />
                </div>
            </section>

            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">Theme</h3>
                <SettingRow
                    title="Appearance"
                    description="Match your system or pick a theme"
                >
                    <MagiSelect
                        width="w-32"
                        value={settings.theme}
                        onChange={(val) => {
                            setSettings({ theme: val as ThemeMode });
                            void saveSettings();
                        }}
                        options={[
                            { label: "System", value: "system" },
                            { label: "Magi", value: "magi" },
                            { label: "Light", value: "light" },
                            { label: "Dark", value: "dark" },
                        ]}
                        ariaLabel="Theme"
                    />
                </SettingRow>
            </section>

            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Interface
                </h3>
                <div className="space-y-3">
                    <SettingToggle
                        title="Show help tooltips"
                        description="Display helpful hints next to options (recommended for new users)"
                        checked={settings.showTooltips}
                        onChange={(checked) => {
                            setSettings({ showTooltips: checked });
                            void saveSettings();
                        }}
                    />
                    <SettingToggle
                        title="Compact rule list"
                        description="Reduce row height for dense rule lists"
                        checked={settings.compactMode}
                        onChange={(checked) => {
                            setSettings({ compactMode: checked });
                            void saveSettings();
                        }}
                    />
                </div>
            </section>

            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Safety
                </h3>
                <div className="space-y-3">
                    <SettingToggle
                        title="Dry run mode"
                        description="Simulate actions without modifying files"
                        checked={settings.dryRun}
                        onChange={(checked) => {
                            setSettings({ dryRun: checked });
                            void saveSettings();
                        }}
                        highlight={settings.dryRun}
                    />
                    <SettingToggle
                        title="Allow permanent deletes"
                        description="Enable delete-permanently actions (recommended off)"
                        checked={settings.allowPermanentDelete}
                        onChange={(checked) => {
                            setSettings({ allowPermanentDelete: checked });
                            void saveSettings();
                        }}
                        highlight={settings.allowPermanentDelete}
                    />
                </div>
            </section>

            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Log retention
                </h3>
                <SettingRow title="Log retention (days)" description="How long to keep history">
                    <input
                        className="w-24 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                        type="number"
                        min={1}
                        value={settings.logRetentionDays}
                        onChange={(e) => {
                            setSettings({ logRetentionDays: Number(e.target.value) });
                            void saveSettings();
                        }}
                    />
                </SettingRow>
            </section>
        </div>
    );
}
