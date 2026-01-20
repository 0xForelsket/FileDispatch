import { useEffect, useMemo, useState } from "react";
import {
  FolderPlus,
  FilePlus,
  LayoutGrid,
  Settings,
  Activity,
  Eye,
  Search,
  ChevronDown,
  X
} from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
      {/* Hazel 6-style Unified Toolbar */}
      <header className={`h-11 bg-[var(--bg-header)] flex items-center shrink-0 relative z-10 transition-all px-3 ${isLinear ? "border-b border-[var(--border-main)]" : "border-b-4 border-[var(--border-main)] shadow-[0_0_15px_var(--border-main)]"
        }`}>
        {/* Left: Folder Management Group */}
        <div className="flex items-center gap-1">
          <AddFolderDialog
            className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
              ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
              : "text-[var(--fg-primary)] border border-transparent hover:border-[var(--fg-primary)] hover:bg-[var(--bg-panel)]"
              }`}
            label=""
            showIcon
            icon={<FolderPlus className="h-4 w-4" strokeWidth={1.5} />}
          />
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-[var(--border-main)] mx-3" />

        {/* Center: Rule Operations Group */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsGalleryOpen(true)}
            disabled={!selectedFolderId}
            className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
              ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] disabled:opacity-40 disabled:hover:bg-transparent"
              : "text-[var(--fg-primary)] hover:text-[var(--fg-alert)] disabled:opacity-40"
              }`}
            title="Templates"
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <button
            onClick={handleNewRule}
            disabled={!selectedFolderId}
            className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
              ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] disabled:opacity-40 disabled:hover:bg-transparent"
              : "border border-[var(--fg-primary)] text-[var(--fg-primary)] hover:bg-[var(--fg-primary)] hover:text-[var(--bg-app)] disabled:opacity-40"
              }`}
            title="New Rule"
          >
            <FilePlus className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <button
            disabled={!selectedFolderId}
            className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
              ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] disabled:opacity-40 disabled:hover:bg-transparent"
              : "text-[var(--fg-primary)] disabled:opacity-40"
              }`}
            title="Rule Status"
          >
            <Activity className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-[var(--border-main)] mx-3" />

        {/* Additional Tools Group - Search */}
        <div className="flex items-center gap-1">
          {isSearchOpen ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter rules..."
                autoFocus
                className="h-6 w-40 px-2 text-xs bg-[var(--bg-panel)] border border-[var(--border-main)] rounded text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent)]"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsSearchOpen(false);
                    setSearchQuery("");
                  }
                }}
              />
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }}
                className="flex items-center justify-center p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
                ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                : "text-[var(--fg-primary)]"
                }`}
              title="Search Rules (Ctrl+F)"
            >
              <Search className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: Global Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsLogExpanded(!isLogExpanded)}
            className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLogExpanded ? "bg-[var(--bg-subtle)] text-[var(--fg-primary)]" : "text-[var(--fg-secondary)]"
              } hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]`}
            title="Activity Log"
          >
            <Eye className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <StatsModal
            total={stats.total}
            efficiency={stats.efficiency}
            savedBytes={stats.savedBytes}
            activeRules={rules.filter((rule) => rule.enabled).length}
            logs={activeLogs}
            trigger={null}
          />

          <SettingsDialog compact trigger={
            <button className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
              ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
              : "text-[var(--fg-primary)] hover:text-[var(--fg-alert)]"
              }`}>
              <Settings className="h-4 w-4" strokeWidth={1.5} />
            </button>
          } />
        </div>
      </header>

      {/* Main Content Area - Grid Layout */}
      <div className={`flex-1 flex min-h-0 bg-[var(--bg-app)]/50 ${isLinear ? "gap-0" : "p-4 gap-4"
        }`}>

        {/* Pane 1: Folders */}
        <aside className={`w-[220px] flex flex-col relative transition-all duration-300 ${isLinear ? "bg-[var(--bg-panel)] border-r border-[var(--border-main)]" : "magi-border bg-black"
          }`}>
          {!isLinear && <AbsoluteCornerDecorations />}

          {/* Pane Header - Hazel style */}
          <div className={`flex items-center gap-2 select-none shrink-0 ${isLinear
            ? "h-8 px-3 border-b border-[var(--border-main)] bg-[var(--bg-subtle)]/50"
            : "bg-[var(--fg-primary)] text-black px-2 py-1 tracking-widest uppercase font-serif font-bold text-sm"
            }`}>
            <span className={`text-[11px] font-medium ${isLinear ? "text-[var(--fg-muted)] uppercase tracking-wider" : ""}`}>
              Folders
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 custom-scrollbar">
            <FolderList />
          </div>
        </aside>

        {/* Pane 2: Rules */}
        <section className={`w-[280px] flex flex-col relative transition-all duration-300 ${isLinear ? "bg-[var(--bg-panel)] border-r border-[var(--border-main)]" : "magi-border bg-[var(--bg-panel)]"
          }`}>
          {!isLinear && <AbsoluteCornerDecorations color="var(--fg-secondary)" />}

          {/* Pane Header - Hazel style with folder name */}
          <div className={`flex items-center gap-2 select-none shrink-0 ${isLinear
            ? "h-8 px-3 border-b border-[var(--border-main)] bg-[var(--bg-subtle)]/50"
            : "bg-[var(--fg-primary)] text-[var(--bg-panel)] px-2 py-1 tracking-widest uppercase font-serif font-bold text-sm"
            }`}>
            {selectedFolderId && activeFolder ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-medium text-[var(--fg-primary)] truncate">
                  {activeFolder.name}
                </span>
                <ChevronDown className="h-3 w-3 text-[var(--fg-muted)] shrink-0" />
              </div>
            ) : (
              <span className={`text-[11px] font-medium ${isLinear ? "text-[var(--fg-muted)] uppercase tracking-wider" : ""}`}>
                Rules
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto relative p-1.5 custom-scrollbar">
            <RuleList
              selectedRuleId={effectiveRule?.id ?? ""}
              onNewRule={handleNewRule}
              onSelectRule={handleSelectRule}
              searchQuery={searchQuery}
            />
          </div>
        </section>

        {/* Pane 3: Editor */}
        <section className={`flex-1 flex flex-col min-w-0 relative transition-all duration-300 ${isLinear ? "bg-[var(--bg-app)]" : "magi-border bg-[var(--bg-panel)]"
          }`}>
          {!isLinear && <AbsoluteCornerDecorations color="var(--fg-alert)" />}

          <div className="flex-1 p-0 overflow-hidden relative">
            {/* Scanlines Overlay */}
            {isMagi ? (
              <div className="absolute inset-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIiAvPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSIxIiBmaWxsPSJyZ2JhKDAsIDAsIDAsIDAuMik1IiAvPgo8L3N2Zz4=')] opacity-20 z-0" />
            ) : null}
            <div className="h-full overflow-y-auto custom-scrollbar relative z-10">
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
        className={`transition-all duration-300 ease-in-out border-t border-[var(--border-main)] bg-[var(--bg-panel)] ${isLogExpanded
          ? "absolute bottom-0 left-0 right-0 h-[calc(100vh-3.5rem)] z-40"
          : "h-8 shrink-0 relative overflow-hidden"
          }`}
      >
        <div className={`h-full w-full ${isLogExpanded ? "p-4" : "p-0"}`}>
          {isLogExpanded ? (
            <div className="h-full w-full rounded border border-[var(--border-main)] bg-[var(--bg-app)] overflow-hidden">
              <ActivityLog onToggleExpand={() => setIsLogExpanded(!isLogExpanded)} expanded={isLogExpanded} />
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 h-full text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer" onClick={() => setIsLogExpanded(true)}>
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3" />
                <span>Activity Log</span>
              </div>
              {logs.length > 0 && (
                <span>Last: {logs[0].filePath.split(/[\\/]/).pop()} ({logs[0].status})</span>
              )}
            </div>
          )}
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
