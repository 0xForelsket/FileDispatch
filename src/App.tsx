import { useEffect, useMemo, useState } from "react";


import { ActivityLog } from "@/components/logs/ActivityLog";
import { AddFolderDialog } from "@/components/folders/AddFolderDialog";
import { FolderList } from "@/components/folders/FolderList";
import { RuleList } from "@/components/rules/RuleList";
import { RuleEditor } from "@/components/rules/RuleEditor";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { StatsModal } from "@/components/ui/StatsModal";
import { useFolders } from "@/hooks/useFolders";
import { useLogs } from "@/hooks/useLogs";
import { useRules } from "@/hooks/useRules";
import { useFolderStore } from "@/stores/folderStore";
import { useLogStore } from "@/stores/logStore";
import { useRuleStore } from "@/stores/ruleStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Rule } from "@/types";

function App() {
  useFolders();
  useRules();
  useLogs();

  const folders = useFolderStore((state) => state.folders);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const rules = useRuleStore((state) => state.rules);
  const logs = useLogStore((state) => state.entries);
  const settings = useSettingsStore((state) => state.settings);

  // Apply Theme
  useEffect(() => {
    const theme = settings.theme;
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", isDark ? "classic" : "standard");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [settings.theme]);

  const [editorMode, setEditorMode] = useState<"empty" | "new" | "edit">("empty");
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isLogExpanded, setIsLogExpanded] = useState(false);

  const effectiveMode = selectedFolderId ? editorMode : "empty";
  const effectiveRule = selectedFolderId ? editingRule : null;

  const activeFolder = folders.find((folder) => folder.id === selectedFolderId);

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

  const handleNewRule = () => {
    if (!selectedFolderId) return;
    setEditingRule(null);
    setEditorMode("new");
  };

  const handleSelectRule = (rule: Rule) => {
    setEditingRule(rule);
    setEditorMode("edit");
  };

  const handleCloseEditor = () => {
    setEditingRule(null);
    setEditorMode("empty");
  };

  return (
    <div className="h-screen w-screen bg-[var(--bg-app)] text-[var(--fg-primary)] font-mono overflow-hidden flex flex-col hex-bg">
      {/* MAGI Header (NERV Style) */}
      <header className="h-12 bg-[var(--bg-header)] border-b-4 border-[var(--border-main)] flex items-center justify-between px-4 shrink-0 shadow-[0_0_15px_var(--border-main)] relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
             {/* Simple Logo Placeholder */}
             <div className="h-8 w-8 bg-[var(--bg-panel)] border-2 border-[var(--fg-alert)] flex items-center justify-center relative">
                 <div className="absolute inset-0 border border-[var(--fg-alert)] rotate-45 scale-75"/>
                 <span className="text-[var(--fg-alert)] font-bold text-xs z-10">NV</span>
             </div>
             <div className="flex flex-col">
                <span className="text-3xl text-[var(--fg-alert)] leading-none eva-title origin-bottom-left">MAGI</span>
                <span className="font-mono text-[10px] text-[var(--fg-primary)] tracking-[0.2em] leading-none">SYSTEM ONLINE</span>
             </div>
          </div>
          {activeFolder ? (
            <div className="hidden md:flex items-center gap-2 pl-4 border-l-2 border-[var(--border-dim)] h-8">
              <span className="text-[10px] uppercase font-bold text-[var(--fg-secondary)] tracking-widest">ACTIVE NODE:</span>
              <span className="text-sm font-bold text-[var(--bg-panel)] font-sans bg-[var(--fg-primary)] px-1">{activeFolder.name.toUpperCase()}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
           {/* Technical Status Indicators */}
           <div className="hidden md:flex gap-1">
              {[1,2,3].map(i => (
                  <div key={i} className={`h-1 w-4 ${i===1 ? 'bg-[var(--fg-secondary)]' : 'bg-[var(--border-dim)]'}`} />
              ))}
           </div>

          <div className="flex items-center gap-2">
            <StatsModal
              total={stats.total}
              efficiency={stats.efficiency}
              savedBytes={stats.savedBytes}
              activeRules={rules.filter((rule) => rule.enabled).length}
              logs={activeLogs}
            />
            <SettingsDialog compact />
          </div>
        </div>
      </header>

      {/* Main Content Area - Grid Layout */}
      <div className="flex-1 flex p-4 gap-4 min-h-0 bg-[var(--bg-app)]/80 backdrop-blur-sm">
        
        {/* Pane 1: Folders */}
        <aside className="w-[260px] flex flex-col magi-border bg-black relative">
          <AbsoluteCornerDecorations />
          <div className="bg-[var(--fg-primary)] text-black px-2 py-1 text-sm font-bold font-serif flex justify-between items-center select-none shrink-0 tracking-widest uppercase mb-1">
             <span>NODES</span>
             <AddFolderDialog
                className="bg-black text-[var(--fg-primary)] px-2 border border-black hover:bg-white hover:text-black font-mono text-xs"
                label="INIT"
                showIcon={false}
             />
          </div>
          <div className="flex-1 overflow-y-auto px-1 pb-1 custom-scrollbar">
            <FolderList />
          </div>
        </aside>

        {/* Pane 2: Rules */}
        <section className="w-[340px] flex flex-col magi-border bg-[var(--bg-panel)] relative">
           <AbsoluteCornerDecorations color="var(--fg-secondary)" />
          <div className="bg-[var(--fg-primary)] text-[var(--bg-panel)] px-2 py-1 text-sm font-bold font-serif flex justify-between items-center select-none shrink-0 tracking-widest uppercase mb-1">
            <span>PROTOCOLS</span>
            <button
               onClick={handleNewRule}
               className="bg-black text-[var(--fg-primary)] px-2 border border-black hover:bg-white hover:text-black font-mono text-xs"
               title="New Rule"
            >
              NEW
            </button>
          </div>
          <div className="flex-1 overflow-y-auto relative px-1 pb-1 custom-scrollbar">
             <RuleList
               selectedRuleId={effectiveRule?.id ?? ""}
               onNewRule={handleNewRule}
               onSelectRule={handleSelectRule}
             />
          </div>
        </section>

        {/* Pane 3: Editor */}
        <section className="flex-1 flex flex-col magi-border bg-[var(--bg-panel)] min-w-0 relative">
           <AbsoluteCornerDecorations color="var(--fg-alert)" />
           <div className="bg-[var(--fg-primary)] text-[var(--bg-panel)] px-2 py-1 text-sm font-bold font-serif select-none shrink-0 tracking-widest uppercase mb-1">
             EXECUTIVE TERMINAL
           </div>
           <div className="flex-1 p-0 overflow-hidden relative">
             {/* Scanlines Overlay */}
             <div className="absolute inset-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIiAvPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSIxIiBmaWxsPSJyZ2JhKDAsIDAsIDAsIDAuMik1IiAvPgo8L3N2Zz4=')] opacity-20 z-0" />
             <div className="h-full overflow-y-auto custom-scrollbar relative z-10 p-4">
                <RuleEditor
                  mode={effectiveMode}
                  onClose={handleCloseEditor}
                  folderId={selectedFolderId ?? ""}
                  rule={effectiveRule}
                />
             </div>
           </div>
        </section>
      </div>

      {/* Footer / Logs - Expandable */}
      <div 
        className={`transition-all duration-300 ease-in-out p-4 pt-0 ${
          isLogExpanded 
            ? "absolute bottom-0 left-0 right-0 h-[calc(100vh-3rem)] z-40 bg-[var(--bg-app)]/95 backdrop-blur-sm" 
            : "h-64 shrink-0 relative"
        }`}
      >
        <div className="h-full w-full bg-[var(--bg-panel)] text-[var(--fg-secondary)] font-mono text-xs p-2 magi-border-sm overflow-y-auto custom-scrollbar relative shadow-lg">
           <div className="absolute top-0 right-0 flex items-center z-10">
              <div className="bg-[var(--fg-secondary)] text-[var(--bg-panel)] text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider">
                  SYSTEM LOG
              </div>
              <button 
                  onClick={() => setIsLogExpanded(!isLogExpanded)}
                  className="ml-2 bg-[#1a1a12] text-[var(--fg-secondary)] border border-[var(--fg-secondary)] h-4 w-4 flex items-center justify-center hover:bg-[var(--fg-secondary)] hover:text-black transition-colors"
                  title={isLogExpanded ? "Minimize" : "Maximize"}
              >
                  {isLogExpanded ? "▼" : "▲"}
              </button>
           </div>
          <ActivityLog />
        </div>
      </div>
    </div>
  );
}

// Decorative Corner Elements for that "Technical" look
function AbsoluteCornerDecorations({ color = "var(--fg-primary)" }: { color?: string }) {
    return (
        <>
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 pointer-events-none" style={{ borderColor: color }} />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 pointer-events-none" style={{ borderColor: color }} />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 pointer-events-none" style={{ borderColor: color }} />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 pointer-events-none" style={{ borderColor: color }} />
        </>
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
