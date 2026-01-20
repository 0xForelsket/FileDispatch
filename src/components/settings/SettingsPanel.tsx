import { useEffect } from "react";
import { MagiSelect } from "@/components/ui/MagiSelect";
import { enable, disable } from "@tauri-apps/plugin-autostart";
import { Switch } from "@/components/ui/Switch";

import { ThemeMode, useSettingsStore } from "@/stores/settingsStore";

interface SettingsPanelProps {
  showTitle?: boolean;
}

export function SettingsPanel({ showTitle = true }: SettingsPanelProps) {
  const settings = useSettingsStore((state) => state.settings);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const saveSettings = useSettingsStore((state) => state.saveSettings);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings.startAtLogin) {
      void enable();
    } else {
      void disable();
    }
  }, [settings.startAtLogin]);

  return (
    <div className="space-y-6">
      {showTitle ? <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Settings</h2> : null}

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
        <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-3">
          <div>
            <div className="font-medium text-[var(--fg-primary)]">Appearance</div>
            <div className="text-xs text-[var(--fg-muted)]">
              Match your system or pick a theme
            </div>
          </div>
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
          />
        </div>
      </section>

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
        </div>
      </section>

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

      <section>
        <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
          Ignore patterns
        </h3>
        <textarea
          className="w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] p-3 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
          rows={3}
          value={settings.ignorePatterns.join("\n")}
          onChange={(e) => {
            setSettings({ ignorePatterns: e.target.value.split(/\n+/).filter(Boolean) });
            void saveSettings();
          }}
        />
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

interface SettingToggleProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  highlight?: boolean;
}


function SettingToggle({
  title,
  description,
  checked,
  onChange,
  highlight = false,
}: SettingToggleProps) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`flex w-full cursor-pointer items-center justify-between rounded-[var(--radius)] border p-3 text-left transition-all ${highlight
        ? "border-[var(--accent)] bg-[var(--accent-muted)]"
        : "border-transparent hover:border-[var(--border-main)] hover:bg-[var(--bg-subtle)]"
        }`}
    >
      <div>
        <div className="font-medium text-[var(--fg-primary)]">{title}</div>
        <div className="text-xs text-[var(--fg-muted)]">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
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
