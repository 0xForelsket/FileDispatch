import { useSettingsStore } from "@/stores/settingsStore";
import { SettingRow, SettingToggle } from "../SettingsShared";

export function PerformancePanel() {
    const settings = useSettingsStore((state) => state.settings);
    const setSettings = useSettingsStore((state) => state.setSettings);
    const saveSettings = useSettingsStore((state) => state.saveSettings);

    return (
        <div className="space-y-6">
            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Performance
                </h3>
                <div className="space-y-3">
                    <SettingRow title="Debounce (ms)" description="Delay before processing changes">
                        <input
                            className="w-24 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                            type="number"
                            min={100}
                            value={settings.debounceMs}
                            onChange={(e) => {
                                setSettings({ debounceMs: Number(e.target.value) });
                                void saveSettings();
                            }}
                        />
                    </SettingRow>
                    <SettingRow title="Preview limit" description="Max files to scan when previewing rules">
                        <input
                            className="w-24 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                            type="number"
                            min={10}
                            max={10000}
                            value={settings.previewMaxFiles}
                            onChange={(e) => {
                                setSettings({ previewMaxFiles: Number(e.target.value) });
                                void saveSettings();
                            }}
                        />
                    </SettingRow>
                    <SettingToggle
                        title="Polling fallback"
                        description="Use polling when native file events fail"
                        checked={settings.pollingFallback}
                        onChange={(checked) => {
                            setSettings({ pollingFallback: checked });
                            void saveSettings();
                        }}
                    />
                </div>
            </section>
        </div>
    );
}
