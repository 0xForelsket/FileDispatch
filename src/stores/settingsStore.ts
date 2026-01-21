import { create } from "zustand";

import { settingsGet, settingsUpdate } from "@/lib/tauri";

export type ThemeMode = "light" | "dark" | "system" | "magi";

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
  dateFormat: string;
  timeFormat: string;
  useShortDateNames: boolean;
  showTooltips: boolean;
  contentEnableOcr: boolean;
  contentMaxTextBytes: number;
  contentMaxOcrImageBytes: number;
  contentMaxOcrPdfBytes: number;
  contentMaxOcrPdfPages: number;
  contentOcrTimeoutImageMs: number;
  contentOcrTimeoutPdfMs: number;
  ocrModelSource: "bundled" | "custom";
  ocrModelDetPath: string;
  ocrModelRecPath: string;
  ocrModelDictPath: string;
  previewMaxFiles: number;
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
  dateFormat: "%Y-%m-%d",
  timeFormat: "%H-%M-%S",
  useShortDateNames: true,
  showTooltips: true,
  contentEnableOcr: true,
  contentMaxTextBytes: 10 * 1024 * 1024,
  contentMaxOcrImageBytes: 15 * 1024 * 1024,
  contentMaxOcrPdfBytes: 30 * 1024 * 1024,
  contentMaxOcrPdfPages: 25,
  contentOcrTimeoutImageMs: 15_000,
  contentOcrTimeoutPdfMs: 120_000,
  ocrModelSource: "bundled",
  ocrModelDetPath: "",
  ocrModelRecPath: "",
  ocrModelDictPath: "",
  previewMaxFiles: 100,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  setSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
  loadSettings: async () => {
    try {
      const settings = await settingsGet();
      const merged = { ...defaultSettings, ...settings };
      set({ settings: { ...merged, theme: normalizeTheme(merged.theme) } });
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

function normalizeTheme(value: unknown): ThemeMode {
  switch (value) {
    case "magi":
    case "light":
    case "dark":
    case "system":
      return value;
    case "classic":
      return "magi";
    case "standard":
      return "light";
    default:
      return "system";
  }
}
