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
  dryRun: boolean;
  contentEnableOcr: boolean;
  contentMaxTextBytes: number;
  contentMaxOcrImageBytes: number;
  contentMaxOcrPdfBytes: number;
  contentMaxOcrPdfPages: number;
  contentOcrTimeoutImageMs: number;
  contentOcrTimeoutPdfMs: number;
  contentEnablePdfOcrTextLayerDev: boolean;
  contentUseCidfontOcr: boolean;
  contentOcrDiagnosticMode: boolean;
  ocrModelSource: "bundled" | "custom";
  ocrModelDetPath: string;
  ocrModelRecPath: string;
  ocrModelDictPath: string;
  ocrPrimaryLanguage: string;
  ocrSecondaryLanguage: string | null;
  ocrConfidenceThreshold: number;
  ocrEnableDeskew: boolean;
  ocrEnableBinarization: boolean;
  previewMaxFiles: number;
}

interface SettingsState {
  settings: AppSettings;
  saveError: string | null;
  setSettings: (settings: Partial<AppSettings>) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  clearSaveError: () => void;
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
  dryRun: false,
  contentEnableOcr: true,
  contentMaxTextBytes: 10 * 1024 * 1024,
  contentMaxOcrImageBytes: 15 * 1024 * 1024,
  contentMaxOcrPdfBytes: 30 * 1024 * 1024,
  contentMaxOcrPdfPages: 25,
  contentOcrTimeoutImageMs: 15_000,
  contentOcrTimeoutPdfMs: 120_000,
  contentEnablePdfOcrTextLayerDev: false,
  contentUseCidfontOcr: false,
  contentOcrDiagnosticMode: false,
  ocrModelSource: "bundled",
  ocrModelDetPath: "",
  ocrModelRecPath: "",
  ocrModelDictPath: "",
  ocrPrimaryLanguage: "",
  ocrSecondaryLanguage: null,
  ocrConfidenceThreshold: 0.6,
  ocrEnableDeskew: false,
  ocrEnableBinarization: false,
  previewMaxFiles: 100,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  saveError: null,
  setSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
  loadSettings: async () => {
    try {
      const settings = await settingsGet();
      const merged = { ...defaultSettings, ...settings };
      set({
        settings: { ...merged, theme: normalizeTheme(merged.theme) },
        saveError: null,
      });
    } catch {
      set({ settings: defaultSettings });
    }
  },
  saveSettings: async () => {
    try {
      await settingsUpdate(get().settings);
      set({ saveError: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ saveError: `Failed to save settings: ${message}` });
    }
  },
  clearSaveError: () => set({ saveError: null }),
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
