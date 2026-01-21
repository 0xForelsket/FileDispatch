import { useEffect } from "react";

import { useSettingsStore } from "@/stores/settingsStore";

export function useSettings() {
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);
}
