import { useEffect } from "react";

import { ActivityLog } from "@/components/logs/ActivityLog";
import { FolderList } from "@/components/folders/FolderList";
import { RuleList } from "@/components/rules/RuleList";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { useFolders } from "@/hooks/useFolders";
import { useLogs } from "@/hooks/useLogs";
import { useRules } from "@/hooks/useRules";
import { useSettingsStore } from "@/stores/settingsStore";

function App() {
  useFolders();
  useRules();
  useLogs();
  const theme = useSettingsStore((state) => state.settings.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", isDark);
    } else {
      root.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid h-screen grid-cols-[280px_1fr]">
        <aside className="flex flex-col gap-6 border-r border-border p-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">File Dispatch</h1>
            <p className="text-xs text-muted-foreground">
              Automated file organization for Linux and Windows.
            </p>
          </div>
          <FolderList />
          <div className="mt-auto">
            <SettingsPanel />
          </div>
        </aside>
        <main className="flex flex-col gap-8 overflow-y-auto p-6">
          <RuleList />
          <ActivityLog />
        </main>
      </div>
    </div>
  );
}

export default App;
