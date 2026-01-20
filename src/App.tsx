import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Plus } from "lucide-react";

import { ActivityLog } from "@/components/logs/ActivityLog";
import { AddFolderDialog } from "@/components/folders/AddFolderDialog";
import { FolderList } from "@/components/folders/FolderList";
import { RuleList } from "@/components/rules/RuleList";
import { RuleEditor } from "@/components/rules/RuleEditor";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { StatsModal } from "@/components/ui/StatsModal";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
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
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [settings.theme]);

  const [editorMode, setEditorMode] = useState<"empty" | "new" | "edit">("empty");
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isLogExpanded, setIsLogExpanded] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

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

  const isMagi = settings.theme === "magi";
  const isLinear = !isMagi;

  return (
    <div
      className="h-screen w-screen bg-[var(--bg-app)] text-[var(--fg-primary)] overflow-hidden flex flex-col hex-bg transition-colors duration-300"
      style={{ fontFamily: "var(--font-stack)" }}
    >
      {/* Header */}
      <header className={`h-12 bg-[var(--bg-header)] border-b flex items-center justify-between px-4 shrink-0 relative z-10 transition-all ${isLinear ? "border-[var(--border-main)] shadow-sm" : "border-[var(--border-main)] shadow-[0_0_15px_var(--border-main)] border-b-4"
        }`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Logo */}
            {isLinear ? (
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-[var(--accent)] rounded-md flex items-center justify-center text-[var(--accent-contrast)] font-bold text-xs shadow-sm">
                  D
                </div>
                <span className="font-bold text-sm tracking-tight">Dispatch</span>
              </div>
            ) : (
              <>
                <div className="h-8 w-8 bg-[var(--bg-panel)] border-2 border-[var(--fg-alert)] flex items-center justify-center relative">
                  <div className="absolute inset-0 border border-[var(--fg-alert)] rotate-45 scale-75" />
                  <span className="text-[var(--fg-alert)] font-bold text-xs z-10">NV</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-3xl text-[var(--fg-alert)] leading-none eva-title origin-bottom-left">MAGI</span>
                  <span className="font-mono text-[10px] text-[var(--fg-primary)] tracking-[0.2em] leading-none">SYSTEM ONLINE</span>
                </div>
              </>
            )}
          </div>
          {activeFolder ? (
            <div className={`hidden md:flex items-center gap-2 pl-4 h-8 ${isLinear ? "border-l border-[var(--border-main)]" : "border-l-2 border-[var(--border-dim)]"}`}>
              {isLinear ? (
                <span className="text-xs font-medium text-[var(--fg-secondary)] bg-[var(--bg-subtle)] border border-[var(--border-main)] px-2 py-0.5 rounded-full">
                  {activeFolder.name}
                </span>
              ) : (
                <>
                  <span className="text-[10px] uppercase font-bold text-[var(--fg-secondary)] tracking-widest">ACTIVE NODE:</span>
                  <span className="text-sm font-bold text-[var(--bg-panel)] font-sans bg-[var(--fg-primary)] px-1">{activeFolder.name.toUpperCase()}</span>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          {isMagi ? (
            <div className="hidden md:flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-1 w-4 ${i === 1 ? 'bg-[var(--fg-secondary)]' : 'bg-[var(--border-dim)]'}`} />
              ))}
            </div>
          ) : null}

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
      <div className={`flex-1 flex min-h-0 bg-[var(--bg-app)]/80 ${isLinear ? "gap-3 p-3" : "p-4 gap-4"
        }`}>

        {/* Pane 1: Folders */}
        <aside className={`w-[260px] flex flex-col relative transition-all duration-300 ${isLinear ? "bg-[var(--bg-panel)] border border-[var(--border-main)]" : "magi-border bg-black"
          }`}>
          {!isLinear && <AbsoluteCornerDecorations />}
          <div className={`flex justify-between items-center select-none shrink-0 mb-1 ${isLinear
            ? "px-3 py-2 border-b border-[var(--border-main)] bg-transparent"
            : "bg-[var(--fg-primary)] text-black px-2 py-1 tracking-widest uppercase font-serif font-bold text-sm"
            }`}>
            {isLinear ? <span className="text-xs font-semibold text-[var(--fg-primary)]">Folders</span> : <span>NODES</span>}
            <AddFolderDialog
              className={
                isLinear
                  ? "flex h-6 w-6 items-center justify-center rounded-[var(--radius)] text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] transition-colors"
                  : "bg-black text-[var(--fg-primary)] px-2 border border-black hover:bg-white hover:text-black font-mono text-xs"
              }
              label={isLinear ? "" : "INIT"}
              showIcon={isLinear}
              icon={isLinear ? <Plus className="h-4 w-4" /> : undefined}
            />
          </div>
          <div className="flex-1 overflow-y-auto px-1 pb-1 custom-scrollbar">
            <FolderList />
          </div>
        </aside>

        {/* Pane 2: Rules */}
        <section className={`w-[340px] flex flex-col relative transition-all duration-300 ${isLinear ? "bg-[var(--bg-panel)] border border-[var(--border-main)]" : "magi-border bg-[var(--bg-panel)]"
          }`}>
          {!isLinear && <AbsoluteCornerDecorations color="var(--fg-secondary)" />}
          <div className={`flex justify-between items-center select-none shrink-0 mb-1 ${isLinear
            ? "px-3 py-2 border-b border-[var(--border-main)] bg-transparent"
            : "bg-[var(--fg-primary)] text-[var(--bg-panel)] px-2 py-1 tracking-widest uppercase font-serif font-bold text-sm"
            }`}>
            <span>{isLinear ? "Rules" : "PROTOCOLS"}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsGalleryOpen(true)}
                className={`flex items-center gap-1 text-xs font-semibold rounded-[var(--radius)] px-2 py-1 transition-colors ${isLinear
                  ? "border border-[var(--border-main)] bg-[var(--bg-panel)] text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                  : "bg-black text-[var(--fg-primary)] border border-black hover:bg-white hover:text-black font-mono"
                  }`}
                title="Browse Templates"
              >
                <LayoutGrid className="h-3 w-3" />
                {isLinear ? "Templates" : "TMPL"}
              </button>
              <button
                onClick={handleNewRule}
                className={`flex items-center gap-1 text-xs font-semibold rounded-[var(--radius)] px-2 py-1 transition-colors ${isLinear
                  ? "bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-90 shadow-sm"
                  : "bg-black text-[var(--fg-primary)] border border-black hover:bg-white hover:text-black font-mono"
                  }`}
                title="Create New Rule"
              >
                <Plus className="h-3 w-3" />
                {isLinear ? "New" : "NEW"}
              </button>
            </div>
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
        <section className={`flex-1 flex flex-col min-w-0 relative transition-all duration-300 ${isLinear ? "bg-[var(--bg-panel)] border border-[var(--border-main)]" : "magi-border bg-[var(--bg-panel)]"
          }`}>
          {!isLinear && <AbsoluteCornerDecorations color="var(--fg-alert)" />}
          <div className={`${isLinear
            ? "px-3 py-2 border-b border-[var(--border-main)] bg-transparent"
            : "bg-[var(--fg-primary)] text-[var(--bg-panel)] px-2 py-1 text-sm font-bold font-serif select-none shrink-0 tracking-widest uppercase mb-1"
            }`}>
            {isLinear ? <span className="text-xs font-semibold text-[var(--fg-primary)]">Rule editor</span> : "EXECUTIVE TERMINAL"}
          </div>
          <div className="flex-1 p-0 overflow-hidden relative">
            {/* Scanlines Overlay */}
            {isMagi ? (
              <div className="absolute inset-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIiAvPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSIxIiBmaWxsPSJyZ2JhKDAsIDAsIDAsIDAuMik1IiAvPgo8L3N2Zz4=')] opacity-20 z-0" />
            ) : null}
            <div className="h-full overflow-y-auto custom-scrollbar relative z-10 p-4">
              <RuleEditor
                key={`${selectedFolderId ?? "none"}:${effectiveRule?.id ?? "new"}:${effectiveMode}`}
                mode={effectiveMode}
                onClose={handleCloseEditor}
                folderId={selectedFolderId ?? ""}
                rule={effectiveRule}
                onNewRule={handleNewRule}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Footer / Logs - Expandable */}
      <div
        className={`transition-all duration-300 ease-in-out p-4 pt-0 ${isLogExpanded
          ? "absolute bottom-0 left-0 right-0 h-[calc(100vh-3rem)] z-40 bg-[var(--bg-app)]/95 backdrop-blur-sm"
          : "h-48 shrink-0 relative"
          }`}
      >
        <div className="h-full w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] text-[var(--fg-secondary)] text-xs p-2 overflow-y-auto custom-scrollbar relative shadow-[var(--shadow-sm)]">
          <ActivityLog onToggleExpand={() => setIsLogExpanded(!isLogExpanded)} expanded={isLogExpanded} />
        </div>
      </div>

      {/* Template Gallery Modal */}
      <TemplateGallery
        folderId={selectedFolderId ?? ""}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
      />
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
