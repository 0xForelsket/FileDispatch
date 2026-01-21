import { useSettingsStore } from "@/stores/settingsStore";

export function AdvancedPanel() {
    const settings = useSettingsStore((state) => state.settings);
    const setSettings = useSettingsStore((state) => state.setSettings);
    const saveSettings = useSettingsStore((state) => state.saveSettings);

    return (
        <div className="space-y-6">
            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Ignore patterns
                </h3>
                <p className="mb-2 text-xs text-[var(--fg-muted)]">
                    These files and folders will be completely ignored by the watcher. Rules will not run on them.
                </p>
                <textarea
                    className="w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] p-3 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                    rows={6}
                    value={settings.ignorePatterns.join("\n")}
                    onChange={(e) => {
                        setSettings({ ignorePatterns: e.target.value.split(/\n+/).filter(Boolean) });
                        void saveSettings();
                    }}
                    placeholder="e.g. node_modules, .git, *.tmp"
                />
            </section>
        </div>
    );
}
