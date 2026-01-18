import { useEffect } from "react";
import { enable, disable } from "@tauri-apps/plugin-autostart";

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
      {showTitle ? <h2 className="text-lg font-semibold">Settings</h2> : null}

      <section>
        <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-neutral-200">
          Startup Behavior
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
        <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-neutral-200">Theme</h3>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/50 p-3 dark:border-white/5">
          <div>
            <div className="font-medium text-slate-700 dark:text-neutral-300">Appearance</div>
            <div className="text-xs text-slate-500 dark:text-neutral-500">
              Match your system or pick a theme
            </div>
          </div>
          <select
            className="rounded-lg border border-slate-200/60 bg-white/60 px-2 py-1 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-neutral-300"
            value={settings.theme}
            onChange={(e) => {
              setSettings({ theme: e.target.value as ThemeMode });
              void saveSettings();
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-neutral-200">
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
        <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-neutral-200">
          Performance
        </h3>
        <div className="space-y-3">
          <SettingRow title="Debounce (ms)" description="Delay before processing changes">
            <input
              className="w-24 rounded-lg border border-slate-200/60 bg-white/60 px-2 py-1 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-neutral-300"
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
        <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-neutral-200">
          Ignore Patterns
        </h3>
        <textarea
          className="w-full rounded-xl border border-slate-200/60 bg-white/60 p-3 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-neutral-300"
          rows={3}
          value={settings.ignorePatterns.join("\n")}
          onChange={(e) => {
            setSettings({ ignorePatterns: e.target.value.split(/\n+/).filter(Boolean) });
            void saveSettings();
          }}
        />
      </section>

      <section>
        <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-neutral-200">
          Log Retention
        </h3>
        <SettingRow title="Log retention (days)" description="How long to keep history">
          <input
            className="w-24 rounded-lg border border-slate-200/60 bg-white/60 px-2 py-1 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-neutral-300"
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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
        highlight
          ? "border-blue-500/20 bg-blue-50/50 dark:border-cyan-500/30 dark:bg-cyan-500/5"
          : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-white/5 dark:hover:bg-white/5"
      }`}
    >
      <div>
        <div className="font-medium text-slate-700 dark:text-neutral-300">{title}</div>
        <div className="text-xs text-slate-500 dark:text-neutral-500">{description}</div>
      </div>
      <span
        className={`relative h-6 w-10 rounded-full transition-all ${
          checked ? "bg-blue-500 dark:bg-cyan-600" : "bg-slate-200 dark:bg-neutral-800"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
            checked ? "right-1" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

interface SettingRowProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ title, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/50 p-3 dark:border-white/5">
      <div>
        <div className="font-medium text-slate-700 dark:text-neutral-300">{title}</div>
        <div className="text-xs text-slate-500 dark:text-neutral-500">{description}</div>
      </div>
      {children}
    </div>
  );
}
