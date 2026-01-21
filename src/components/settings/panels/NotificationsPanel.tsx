import { useSettingsStore } from "@/stores/settingsStore";
import { SettingToggle } from "../SettingsShared";

export function NotificationsPanel() {
    const settings = useSettingsStore((state) => state.settings);
    const setSettings = useSettingsStore((state) => state.setSettings);
    const saveSettings = useSettingsStore((state) => state.saveSettings);

    return (
        <div className="space-y-6">
            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Notifications
                </h3>
                <div className="space-y-3">
                    <SettingToggle
                        title="Show notifications"
                        description="Display system notifications for rule actions"
                        checked={settings.showNotifications}
                        onChange={(checked) => {
                            setSettings({ showNotifications: checked });
                            void saveSettings();
                        }}
                    />
                </div>
            </section>
        </div>
    );
}
