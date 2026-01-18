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
    <div className="space-y-4">
      {showTitle ? <h2 className="text-lg font-semibold">Settings</h2> : null}
      <div className="grid gap-3 text-sm">
        <label className="flex items-center justify-between gap-4">
          <span>Theme</span>
          <select
            className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
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
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>Start at login</span>
          <input
            type="checkbox"
            checked={settings.startAtLogin}
            onChange={async (e) => {
              setSettings({ startAtLogin: e.target.checked });
              if (e.target.checked) {
                await enable();
              } else {
                await disable();
              }
              void saveSettings();
            }}
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>Show notifications</span>
          <input
            type="checkbox"
            checked={settings.showNotifications}
            onChange={(e) => {
              setSettings({ showNotifications: e.target.checked });
              void saveSettings();
            }}
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>Minimize to tray</span>
          <input
            type="checkbox"
            checked={settings.minimizeToTray}
            onChange={(e) => {
              setSettings({ minimizeToTray: e.target.checked });
              void saveSettings();
            }}
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>Debounce (ms)</span>
          <input
            className="w-24 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
            type="number"
            min={100}
            value={settings.debounceMs}
            onChange={(e) => {
              setSettings({ debounceMs: Number(e.target.value) });
              void saveSettings();
            }}
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>Polling fallback</span>
          <input
            type="checkbox"
            checked={settings.pollingFallback}
            onChange={(e) => {
              setSettings({ pollingFallback: e.target.checked });
              void saveSettings();
            }}
          />
        </label>
        <div>
          <label className="text-xs uppercase text-muted-foreground">Ignore patterns</label>
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-transparent p-2 text-sm"
            rows={3}
            value={settings.ignorePatterns.join("\n")}
            onChange={(e) => {
              setSettings({ ignorePatterns: e.target.value.split(/\n+/).filter(Boolean) });
              void saveSettings();
            }}
          />
        </div>
        <label className="flex items-center justify-between gap-4">
          <span>Log retention (days)</span>
          <input
            className="w-24 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
            type="number"
            min={1}
            value={settings.logRetentionDays}
            onChange={(e) => {
              setSettings({ logRetentionDays: Number(e.target.value) });
              void saveSettings();
            }}
          />
        </label>
      </div>
    </div>
  );
}
