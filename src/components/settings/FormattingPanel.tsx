import { MagiSelect } from "@/components/ui/MagiSelect";
import { useSettingsStore } from "@/stores/settingsStore";

export function FormattingPanel() {
    const settings = useSettingsStore((state) => state.settings);
    const setSettings = useSettingsStore((state) => state.setSettings);
    const saveSettings = useSettingsStore((state) => state.saveSettings);

    return (
        <div className="space-y-6">
            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Date & Time Patterns
                </h3>
                <p className="mb-4 text-xs text-[var(--fg-muted)]">
                    Configure how pattern tokens like {"{date}"}, {"{time}"}, {"{weekday}"}, and{" "}
                    {"{monthname}"} are formatted.
                </p>
                <div className="space-y-3">
                    <SettingRow title="Date format" description="Format for {date} pattern token">
                        <MagiSelect
                            width="w-40"
                            value={settings.dateFormat}
                            onChange={(val) => {
                                setSettings({ dateFormat: val });
                                void saveSettings();
                            }}
                            options={[
                                { label: "2025-09-22", value: "%Y-%m-%d" },
                                { label: "22/09/2025", value: "%d/%m/%Y" },
                                { label: "09-22-2025", value: "%m-%d-%Y" },
                                { label: "20250922", value: "%Y%m%d" },
                            ]}
                            ariaLabel="Date format"
                        />
                    </SettingRow>
                    <SettingRow title="Time format" description="Format for {time} pattern token">
                        <MagiSelect
                            width="w-40"
                            value={settings.timeFormat}
                            onChange={(val) => {
                                setSettings({ timeFormat: val });
                                void saveSettings();
                            }}
                            options={[
                                { label: "14-30-45", value: "%H-%M-%S" },
                                { label: "14:30:45", value: "%H:%M:%S" },
                                { label: "143045", value: "%H%M%S" },
                            ]}
                            ariaLabel="Time format"
                        />
                    </SettingRow>
                </div>
            </section>

            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Named Formats
                </h3>
                <div className="space-y-3">
                    <SettingToggle
                        title="Use short date names"
                        description="{weekday} shows Mon instead of Monday, {monthname} shows Sep instead of September"
                        checked={settings.useShortDateNames}
                        onChange={(checked) => {
                            setSettings({ useShortDateNames: checked });
                            void saveSettings();
                        }}
                    />
                </div>
            </section>

            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Quick Reference
                </h3>
                <div className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-4 text-xs">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[var(--fg-muted)]">
                                <th className="pb-2">Token</th>
                                <th className="pb-2">Output</th>
                            </tr>
                        </thead>
                        <tbody className="text-[var(--fg-secondary)]">
                            <tr><td className="py-1 font-mono">{"{date}"}</td><td>2025-09-22</td></tr>
                            <tr><td className="py-1 font-mono">{"{time}"}</td><td>14-30-45</td></tr>
                            <tr><td className="py-1 font-mono">{"{year}"}</td><td>2025</td></tr>
                            <tr><td className="py-1 font-mono">{"{month}"}</td><td>09</td></tr>
                            <tr><td className="py-1 font-mono">{"{day}"}</td><td>22</td></tr>
                            <tr><td className="py-1 font-mono">{"{weekday}"}</td><td>Mon / Monday</td></tr>
                            <tr><td className="py-1 font-mono">{"{monthname}"}</td><td>Sep / September</td></tr>
                            <tr><td className="py-1 font-mono">{"{week}"}</td><td>38</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

interface SettingRowProps {
    title: string;
    description: string;
    children: React.ReactNode;
}

function SettingRow({ title, description, children }: SettingRowProps) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-3">
            <div>
                <div className="font-medium text-[var(--fg-primary)]">{title}</div>
                <div className="text-xs text-[var(--fg-muted)]">{description}</div>
            </div>
            {children}
        </div>
    );
}

interface SettingToggleProps {
    title: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

function SettingToggle({ title, description, checked, onChange }: SettingToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="flex w-full items-center justify-between rounded-[var(--radius)] border border-transparent p-3 text-left transition-colors hover:border-[var(--border-main)] hover:bg-[var(--bg-subtle)]"
        >
            <div>
                <div className="font-medium text-[var(--fg-primary)]">{title}</div>
                <div className="text-xs text-[var(--fg-muted)]">{description}</div>
            </div>
            <span
                className={`relative h-6 w-10 rounded-full border border-[var(--border-main)] transition-colors ${checked ? "bg-[var(--accent)]" : "bg-[var(--bg-panel)]"
                  }`}
            >
                <span
                    className={`absolute top-1 h-4 w-4 rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-sm transition-transform ${checked ? "right-1" : "left-1"
                      }`}
                />
            </span>
        </button>
    );
}
