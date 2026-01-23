import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { AppSettings } from "./settingsStore";

// Create mock function
type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
const mockInvoke = mock<InvokeFn>(() => Promise.resolve(null));

// Mock the Tauri invoke at the source
mock.module("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

// Import store after mocking
const { useSettingsStore, defaultSettings } = await import("./settingsStore");

describe("useSettingsStore", () => {
  beforeEach(() => {
    // Reset store state
    useSettingsStore.setState({
      settings: { ...defaultSettings },
      saveError: null,
    });

    mockInvoke.mockClear();
  });

  describe("initial state", () => {
    test("starts with default settings", () => {
      const state = useSettingsStore.getState();
      expect(state.settings).toEqual(defaultSettings);
      expect(state.saveError).toBeNull();
    });

    test("default settings have expected values", () => {
      expect(defaultSettings.startAtLogin).toBe(true);
      expect(defaultSettings.showNotifications).toBe(true);
      expect(defaultSettings.minimizeToTray).toBe(true);
      expect(defaultSettings.debounceMs).toBe(500);
      expect(defaultSettings.maxConcurrentRules).toBe(4);
      expect(defaultSettings.theme).toBe("system");
      expect(defaultSettings.logRetentionDays).toBe(30);
      expect(defaultSettings.contentEnableOcr).toBe(true);
    });
  });

  describe("setSettings", () => {
    test("updates partial settings", () => {
      useSettingsStore.getState().setSettings({ debounceMs: 1000 });

      const state = useSettingsStore.getState();
      expect(state.settings.debounceMs).toBe(1000);
      // Other settings should remain unchanged
      expect(state.settings.showNotifications).toBe(true);
    });

    test("updates multiple settings at once", () => {
      useSettingsStore.getState().setSettings({
        debounceMs: 750,
        showNotifications: false,
        theme: "dark",
      });

      const state = useSettingsStore.getState();
      expect(state.settings.debounceMs).toBe(750);
      expect(state.settings.showNotifications).toBe(false);
      expect(state.settings.theme).toBe("dark");
    });

    test("preserves unmodified settings", () => {
      const originalSettings = { ...useSettingsStore.getState().settings };
      useSettingsStore.getState().setSettings({ theme: "light" });

      const state = useSettingsStore.getState();
      expect(state.settings.startAtLogin).toBe(originalSettings.startAtLogin);
      expect(state.settings.minimizeToTray).toBe(originalSettings.minimizeToTray);
      expect(state.settings.logRetentionDays).toBe(originalSettings.logRetentionDays);
    });
  });

  describe("loadSettings", () => {
    test("loads settings from backend", async () => {
      const backendSettings = {
        ...defaultSettings,
        debounceMs: 1000,
        showNotifications: false,
        theme: "dark" as const,
      };
      mockInvoke.mockResolvedValueOnce(backendSettings);

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.settings.debounceMs).toBe(1000);
      expect(state.settings.showNotifications).toBe(false);
      expect(state.settings.theme).toBe("dark");
      expect(state.saveError).toBeNull();
      expect(mockInvoke).toHaveBeenCalledWith("settings_get");
    });

    test("merges backend settings with defaults", async () => {
      // Backend returns partial settings
      const partialSettings = {
        debounceMs: 750,
        theme: "light",
      };
      mockInvoke.mockResolvedValueOnce(partialSettings as AppSettings);

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      // Loaded value
      expect(state.settings.debounceMs).toBe(750);
      expect(state.settings.theme).toBe("light");
      // Default values for missing keys
      expect(state.settings.showNotifications).toBe(defaultSettings.showNotifications);
      expect(state.settings.logRetentionDays).toBe(defaultSettings.logRetentionDays);
    });

    test("falls back to defaults on error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Load failed"));

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.settings).toEqual(defaultSettings);
    });

    test("normalizes legacy theme values", async () => {
      // Test "classic" -> "magi" normalization
      mockInvoke.mockResolvedValueOnce({
        ...defaultSettings,
        theme: "classic",
      } as unknown as AppSettings);

      await useSettingsStore.getState().loadSettings();

      expect(useSettingsStore.getState().settings.theme).toBe("magi");
    });

    test("normalizes standard theme to light", async () => {
      mockInvoke.mockResolvedValueOnce({
        ...defaultSettings,
        theme: "standard",
      } as unknown as AppSettings);

      await useSettingsStore.getState().loadSettings();

      expect(useSettingsStore.getState().settings.theme).toBe("light");
    });

    test("normalizes unknown theme to system", async () => {
      mockInvoke.mockResolvedValueOnce({
        ...defaultSettings,
        theme: "invalid_theme",
      } as unknown as AppSettings);

      await useSettingsStore.getState().loadSettings();

      expect(useSettingsStore.getState().settings.theme).toBe("system");
    });
  });

  describe("saveSettings", () => {
    test("saves current settings to backend", async () => {
      const customSettings = {
        ...defaultSettings,
        debounceMs: 1000,
        theme: "dark" as const,
      };
      useSettingsStore.setState({ settings: customSettings });
      mockInvoke.mockResolvedValueOnce(undefined);

      await useSettingsStore.getState().saveSettings();

      expect(mockInvoke).toHaveBeenCalledWith("settings_update", { settings: customSettings });
      expect(useSettingsStore.getState().saveError).toBeNull();
    });

    test("sets error on save failure", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Save failed"));

      await useSettingsStore.getState().saveSettings();

      const state = useSettingsStore.getState();
      expect(state.saveError).toContain("Failed to save settings");
      expect(state.saveError).toContain("Save failed");
    });

    test("handles non-Error rejection", async () => {
      mockInvoke.mockRejectedValueOnce("String error");

      await useSettingsStore.getState().saveSettings();

      const state = useSettingsStore.getState();
      expect(state.saveError).toContain("String error");
    });

    test("clears previous error on successful save", async () => {
      useSettingsStore.setState({ saveError: "Previous error" });
      mockInvoke.mockResolvedValueOnce(undefined);

      await useSettingsStore.getState().saveSettings();

      expect(useSettingsStore.getState().saveError).toBeNull();
    });
  });

  describe("clearSaveError", () => {
    test("clears save error", () => {
      useSettingsStore.setState({ saveError: "Some error" });

      useSettingsStore.getState().clearSaveError();

      expect(useSettingsStore.getState().saveError).toBeNull();
    });

    test("does nothing when no error", () => {
      useSettingsStore.setState({ saveError: null });

      useSettingsStore.getState().clearSaveError();

      expect(useSettingsStore.getState().saveError).toBeNull();
    });
  });

  describe("individual settings", () => {
    test("updates ignore patterns array", () => {
      const newPatterns = [".DS_Store", "*.bak", "~*"];
      useSettingsStore.getState().setSettings({ ignorePatterns: newPatterns });

      expect(useSettingsStore.getState().settings.ignorePatterns).toEqual(newPatterns);
    });

    test("updates OCR settings", () => {
      useSettingsStore.getState().setSettings({
        contentEnableOcr: false,
        contentMaxOcrPdfPages: 50,
        ocrConfidenceThreshold: 0.8,
      });

      const state = useSettingsStore.getState();
      expect(state.settings.contentEnableOcr).toBe(false);
      expect(state.settings.contentMaxOcrPdfPages).toBe(50);
      expect(state.settings.ocrConfidenceThreshold).toBe(0.8);
    });

    test("updates date/time format settings", () => {
      useSettingsStore.getState().setSettings({
        dateFormat: "%d/%m/%Y",
        timeFormat: "%I:%M %p",
        useShortDateNames: false,
      });

      const state = useSettingsStore.getState();
      expect(state.settings.dateFormat).toBe("%d/%m/%Y");
      expect(state.settings.timeFormat).toBe("%I:%M %p");
      expect(state.settings.useShortDateNames).toBe(false);
    });

    test("updates OCR model source", () => {
      useSettingsStore.getState().setSettings({
        ocrModelSource: "custom",
        ocrModelDetPath: "/path/to/det.onnx",
        ocrModelRecPath: "/path/to/rec.onnx",
        ocrModelDictPath: "/path/to/dict.txt",
      });

      const state = useSettingsStore.getState();
      expect(state.settings.ocrModelSource).toBe("custom");
      expect(state.settings.ocrModelDetPath).toBe("/path/to/det.onnx");
    });

    test("updates OCR language settings", () => {
      useSettingsStore.getState().setSettings({
        ocrPrimaryLanguage: "zh",
        ocrSecondaryLanguage: "en",
      });

      const state = useSettingsStore.getState();
      expect(state.settings.ocrPrimaryLanguage).toBe("zh");
      expect(state.settings.ocrSecondaryLanguage).toBe("en");
    });
  });

  describe("edge cases", () => {
    test("handles empty settings update", () => {
      const originalSettings = { ...useSettingsStore.getState().settings };

      useSettingsStore.getState().setSettings({});

      expect(useSettingsStore.getState().settings).toEqual(originalSettings);
    });

    test("handles null secondary language", () => {
      useSettingsStore.getState().setSettings({
        ocrSecondaryLanguage: null,
      });

      expect(useSettingsStore.getState().settings.ocrSecondaryLanguage).toBeNull();
    });

    test("handles zero values correctly", () => {
      useSettingsStore.getState().setSettings({
        debounceMs: 0,
        logRetentionDays: 0,
        previewMaxFiles: 0,
      });

      const state = useSettingsStore.getState();
      expect(state.settings.debounceMs).toBe(0);
      expect(state.settings.logRetentionDays).toBe(0);
      expect(state.settings.previewMaxFiles).toBe(0);
    });
  });
});
