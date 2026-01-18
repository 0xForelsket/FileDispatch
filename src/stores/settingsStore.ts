import { create } from "zustand";

import { settingsGet, settingsUpdate } from "@/lib/tauri";

export type ThemeMode = "light" | "dark" | "system" | "classic" | "standard";

export interface AppSettings {
  startAtLogin: boolean;
  showNotifications: boolean;
  minimizeToTray: boolean;
  debounceMs: number;
  maxConcurrentRules: number;
  pollingFallback: boolean;
  ignorePatterns: string[];
  logRetentionDays: number;
  theme: ThemeMode;
}

interface SettingsState {
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const defaultSettings: AppSettings = {
  startAtLogin: true,
  showNotifications: true,
  minimizeToTray: true,
  debounceMs: 500,
  maxConcurrentRules: 4,
  pollingFallback: false,
  ignorePatterns: [".DS_Store", "Thumbs.db", ".git", "node_modules", "*.tmp", "*.part"],
  logRetentionDays: 30,
  theme: "system",
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  setSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
  loadSettings: async () => {
    try {
      const settings = await settingsGet();
      set({ settings: { ...defaultSettings, ...settings } });
    } catch {
      set({ settings: defaultSettings });
    }
  },
  saveSettings: async () => {
    try {
      await settingsUpdate(get().settings);
    } catch {
      // ignore for now
    }
  },
}));
