import { useEffect } from "react";

import { ActivityLog } from "@/components/logs/ActivityLog";
import { FolderList } from "@/components/folders/FolderList";
import { RuleList } from "@/components/rules/RuleList";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
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
      <div className="flex h-screen flex-col lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="flex flex-col gap-6 border-b border-border p-5 lg:border-b-0 lg:border-r">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">File Dispatch</h1>
            <p className="text-xs text-muted-foreground">
              Automated file organization for Linux and Windows.
            </p>
          </div>
          <FolderList />
          <div className="mt-auto border-t border-border pt-4">
            <SettingsDialog />
          </div>
        </aside>
        <main className="flex flex-col gap-8 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            <RuleList />
            <div className="border-t border-border pt-6">
              <ActivityLog />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
