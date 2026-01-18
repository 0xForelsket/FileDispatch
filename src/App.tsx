import { useEffect, useMemo } from "react";
import {
  BarChart3,
  Cpu,
  FileDigit,
  Folder,
  MoreVertical,
  Moon,
  Plus,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";

import { ActivityLog } from "@/components/logs/ActivityLog";
import { AddFolderDialog } from "@/components/folders/AddFolderDialog";
import { FolderList } from "@/components/folders/FolderList";
import { RuleList } from "@/components/rules/RuleList";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { useFolders } from "@/hooks/useFolders";
import { useLogs } from "@/hooks/useLogs";
import { useRules } from "@/hooks/useRules";
import { useFolderStore } from "@/stores/folderStore";
import { useLogStore } from "@/stores/logStore";
import { useRuleStore } from "@/stores/ruleStore";
import { useSettingsStore } from "@/stores/settingsStore";

function App() {
  useFolders();
  useRules();
  useLogs();
  const theme = useSettingsStore((state) => state.settings.theme);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const saveSettings = useSettingsStore((state) => state.saveSettings);
  const folders = useFolderStore((state) => state.folders);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const removeFolder = useFolderStore((state) => state.removeFolder);
  const rules = useRuleStore((state) => state.rules);
  const logs = useLogStore((state) => state.entries);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", isDark);
    } else {
      root.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  const mounted = true;

  const isDark = useMemo(() => {
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, [theme]);

  const activeFolder = folders.find((folder) => folder.id === selectedFolderId);
  const gridColor = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";

  const activeLogs = useMemo(() => {
    if (!selectedFolderId) return logs;
    const activeRuleIds = new Set(rules.map((rule) => rule.id));
    return logs.filter((entry) => entry.ruleId && activeRuleIds.has(entry.ruleId));
  }, [logs, rules, selectedFolderId]);

  const stats = useMemo(() => {
    const total = activeLogs.length;
    const success = activeLogs.filter((entry) => entry.status === "success").length;
    const efficiency = total > 0 ? Math.round((success / total) * 100) : 100;
    const savedBytes = activeLogs.reduce((sum, entry) => {
      if (entry.actionType === "delete" || entry.actionType === "deletePermanently") {
        return sum + getSizeBytes(entry);
      }
      return sum;
    }, 0);
    return { total, efficiency, savedBytes };
  }, [activeLogs]);

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setSettings({ theme: next });
    void saveSettings();
  };

  return (
    <div className={`${isDark ? "dark" : ""} relative h-screen w-full overflow-hidden`}>
      <div className="absolute inset-0 z-0 bg-[#f8fafc] transition-colors duration-700 dark:bg-[#0a0a0a]">
        <div className="animate-pulse-slow absolute left-[-10%] top-[-20%] h-[50vw] w-[50vw] rounded-full bg-blue-500/10 blur-[120px] dark:bg-cyan-500/10" />
        <div className="animate-pulse-slower absolute bottom-[-10%] right-[-10%] h-[40vw] w-[40vw] rounded-full bg-indigo-500/10 blur-[100px] dark:bg-violet-500/10" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay dark:opacity-[0.15]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E\")",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(to right, ${gridColor} 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div
        className={`relative z-10 flex h-screen font-sans text-slate-600 transition-opacity duration-700 dark:text-neutral-300 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      >
        <aside className="flex w-[280px] flex-col border-r border-white/20 bg-white/30 backdrop-blur-2xl transition-all duration-500 dark:border-white/5 dark:bg-black/20">
          <div className="p-6 pb-2">
            <div className="group mb-8 flex cursor-pointer items-center gap-3.5">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-blue-500 opacity-20 blur-md transition-opacity group-hover:opacity-40 dark:bg-cyan-500" />
                <div className="relative rounded-xl border border-white/60 bg-gradient-to-br from-white to-slate-100 p-2.5 shadow-lg ring-1 ring-black/5 dark:border-white/10 dark:from-neutral-800 dark:to-neutral-900">
                  <Zap className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
                </div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  DISPATCH
                </h1>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-cyan-500">
                  Command Center
                </span>
              </div>
            </div>

            <AddFolderDialog
              className="group relative flex w-full items-center justify-center gap-2 rounded-xl border border-white/60 bg-gradient-to-b from-white to-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:shadow-lg dark:border-white/10 dark:from-white/10 dark:to-white/5 dark:text-neutral-200"
              label="New Watcher"
              icon={<Plus className="h-4 w-4 text-blue-600 transition-transform group-hover:rotate-90 dark:text-cyan-400" />}
            />
          </div>

          <div className="flex-1 overflow-hidden">
            <FolderList />
          </div>

          <div className="mt-auto flex items-center gap-2 border-t border-white/20 p-4 dark:border-white/5">
            <SettingsDialog />
            <button
              onClick={toggleTheme}
              className="rounded-xl border border-transparent p-2.5 text-slate-600 transition-all hover:border-white/40 hover:bg-white/60 hover:text-slate-900 dark:text-neutral-400 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:text-white"
              type="button"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </aside>

        <main className="relative flex h-full flex-1 flex-col overflow-hidden">
          <header className="flex items-start justify-between px-8 py-6">
            <div>
              <div className="mb-2 flex items-center gap-4">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {activeFolder?.name ?? "Select a folder"}
                </h2>
                {activeFolder ? (
                  <div
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      activeFolder.enabled
                        ? "border-green-500/20 bg-green-500/10 text-green-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300"
                        : "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:border-neutral-500/20 dark:bg-neutral-500/10 dark:text-neutral-400"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        activeFolder.enabled
                          ? "bg-green-500 dark:bg-cyan-400 animate-pulse"
                          : "bg-slate-400"
                      }`}
                    />
                    {activeFolder.enabled ? "Live Monitoring" : "Offline"}
                  </div>
                ) : null}
              </div>
              {activeFolder ? (
                <div className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-cyan-500">
                    <Folder className="h-3 w-3" />
                    source:
                  </span>
                  <span className="rounded border border-white/40 bg-white/50 px-2 py-1 text-slate-600 backdrop-blur-sm transition-colors hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10">
                    {activeFolder.path}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/40 bg-white/40 text-slate-400 transition-all hover:scale-105 hover:bg-red-50 hover:text-red-600 hover:shadow-lg dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                onClick={() => {
                  if (activeFolder?.id) {
                    void removeFolder(activeFolder.id);
                  }
                }}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/40 bg-white/40 text-slate-400 transition-all hover:scale-105 hover:bg-white/60 hover:text-slate-900 hover:shadow-lg dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
                type="button"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="custom-scrollbar flex-1 overflow-y-auto p-8 pb-20">
            <div className="mx-auto max-w-6xl space-y-12">
              <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <GlassCard className="flex h-32 flex-col justify-between p-5" hoverEffect>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                        Throughput
                      </div>
                      <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        {stats.total}{" "}
                        <span className="text-sm font-normal text-slate-500 dark:text-neutral-500">
                          files
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-cyan-500/10 dark:text-cyan-400">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-2 flex h-8 items-end gap-1">
                    {[40, 70, 45, 90, 60, 75, 50, 80, 95, 60].map((height, index) => (
                      <div
                        key={index}
                        className="flex-1 rounded-sm bg-blue-200/50 transition-colors hover:bg-blue-400 dark:bg-cyan-500/20 dark:hover:bg-cyan-400"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="flex h-32 flex-col justify-between p-5" hoverEffect>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                        Efficiency
                      </div>
                      <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        {stats.efficiency}%
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <Cpu className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-auto">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
                        style={{ width: `${stats.efficiency}%` }}
                      />
                    </div>
                    <div className="mt-2 text-right text-[10px] text-slate-400 dark:text-neutral-500">
                      {rules.filter((rule) => rule.enabled).length} active rules
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="flex h-32 flex-col justify-between p-5" hoverEffect>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                        Storage Saved
                      </div>
                      <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        {formatBytes(stats.savedBytes)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                      <FileDigit className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-auto flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                    <span className="flex items-center gap-0.5 font-semibold text-green-500">
                      +12%
                    </span>
                    <span>vs last week</span>
                  </div>
                </GlassCard>
              </section>

              <RuleList />
              <ActivityLog />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;

function getSizeBytes(entry: { actionDetail?: { metadata?: Record<string, string> } }) {
  const value =
    entry.actionDetail?.metadata?.size_bytes ??
    entry.actionDetail?.metadata?.sizeBytes ??
    entry.actionDetail?.metadata?.["size-bytes"];
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 GB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
