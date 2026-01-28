import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  FilePlus,
  FileDown,
  FileUp,
  FileSearch,
  LayoutGrid,
  Settings,
  FolderCog,
  Activity,
  Eye,
  Search,
  ChevronDown,
  X
} from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

import { ActivityLog } from "@/components/logs/ActivityLog";
import { AddFolderDialog } from "@/components/folders/AddFolderDialog";
import { AddGroupDialog } from "@/components/folders/AddGroupDialog";
import { FolderOptionsDialog } from "@/components/folders/FolderOptionsDialog";
import { FolderList } from "@/components/folders/FolderList";
import { RuleList } from "@/components/rules/RuleList";
import { RuleEditor } from "@/components/rules/RuleEditor";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { StatsModal } from "@/components/ui/StatsModal";
import { AddFolderIcon, AddGroupIcon } from "@/components/ui/CustomIcons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import { PresetImportDialog } from "@/components/presets/PresetImportDialog";
import { RuleStatusDialog } from "@/components/status/RuleStatusDialog";
import { ToastViewport } from "@/components/ui/ToastViewport";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { useFolders } from "@/hooks/useFolders";
import { useEngineStatus } from "@/hooks/useEngineStatus";
import { useLogs } from "@/hooks/useLogs";
import { useRules } from "@/hooks/useRules";
import { useSettings } from "@/hooks/useSettings";
import { ruleExport, ruleImport } from "@/lib/tauri";
import { useFolderStore } from "@/stores/folderStore";
import { useLogStore } from "@/stores/logStore";
import { useRuleStore } from "@/stores/ruleStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Rule } from "@/types";
import { normalizeRuleImportPayload } from "@/lib/ruleTransfer";
import { useEngineStore } from "@/stores/engineStore";
import { useShallow } from "zustand/shallow";
import { useEditorStore } from "@/stores/editorStore";

function App() {
  useFolders();
  useRules();
  useLogs();
  useSettings();
  useEngineStatus();

  const { folders, selectedFolderId } = useFolderStore(
    useShallow((state) => ({
      folders: state.folders,
      selectedFolderId: state.selectedFolderId,
    })),
  );
  const { rules, loadRules } = useRuleStore(
    useShallow((state) => ({
      rules: state.rules,
      loadRules: state.loadRules,
    })),
  );
  const logs = useLogStore((state) => state.entries);
  const settings = useSettingsStore((state) => state.settings);
  const { togglePaused, status: engineStatus } = useEngineStore(
    useShallow((state) => ({
      togglePaused: state.togglePaused,
      status: state.status,
    })),
  );
  const editorDirty = useEditorStore((state) => state.isDirty);

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
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRuleExporting, setIsRuleExporting] = useState(false);
  const [isRuleImporting, setIsRuleImporting] = useState(false);
  const [ruleTransferError, setRuleTransferError] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [paneWidths, setPaneWidths] = useState(() => {
    if (typeof window === "undefined") {
      return { folders: 220, rules: 280 };
    }
    const stored = window.localStorage.getItem("filedispatch.paneWidths");
    if (!stored) return { folders: 220, rules: 280 };
    try {
      const parsed = JSON.parse(stored) as { folders?: number; rules?: number };
      return {
        folders: parsed.folders ?? 220,
        rules: parsed.rules ?? 280,
      };
    } catch {
      return { folders: 220, rules: 280 };
    }
  });
  const resizeRef = useRef<{
    pane: "folders" | "rules" | null;
    startX: number;
    startWidth: number;
  }>({ pane: null, startX: 0, startWidth: 0 });
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem("filedispatch.paneWidths", JSON.stringify(paneWidths));
    } catch {
      return;
    }
  }, [paneWidths]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const current = resizeRef.current;
      if (!current.pane) return;
      const delta = event.clientX - current.startX;
      if (current.pane === "folders") {
        const next = Math.min(360, Math.max(180, current.startWidth + delta));
        setPaneWidths((prev) => ({ ...prev, folders: next }));
      } else if (current.pane === "rules") {
        const next = Math.min(420, Math.max(220, current.startWidth + delta));
        setPaneWidths((prev) => ({ ...prev, rules: next }));
      }
    };
    const handleUp = () => {
      if (resizeRef.current.pane) {
        resizeRef.current.pane = null;
        document.body.style.cursor = "";
      }
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  useEffect(() => {
    if (!editorDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editorDirty]);

  const startResize = (pane: "folders" | "rules") => (event: React.MouseEvent) => {
    resizeRef.current = {
      pane,
      startX: event.clientX,
      startWidth: pane === "folders" ? paneWidths.folders : paneWidths.rules,
    };
    document.body.style.cursor = "col-resize";
    event.preventDefault();
  };

  const effectiveMode = selectedFolderId ? editorMode : "empty";
  const effectiveRule = selectedFolderId ? editingRule : null;

  const activeFolder = folders.find((folder) => folder.id === selectedFolderId);

  useEffect(() => {
    setRuleTransferError(null);
  }, [selectedFolderId]);

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

  const runWithDirtyCheck = useCallback((action: () => void) => {
    if (editorDirty) {
      pendingActionRef.current = action;
      setShowDiscardConfirm(true);
      return;
    }
    action();
  }, [editorDirty]);

  const handleNewRule = useCallback(() => {
    if (!selectedFolderId) return;
    runWithDirtyCheck(() => {
      setEditingRule(null);
      setEditorMode("new");
    });
  }, [selectedFolderId, runWithDirtyCheck]);

  const handleSelectRule = useCallback((rule: Rule) => {
    runWithDirtyCheck(() => {
      setEditingRule(rule);
      setEditorMode("edit");
    });
  }, [runWithDirtyCheck]);

  const handleCloseEditor = useCallback(() => {
    runWithDirtyCheck(() => {
      setEditingRule(null);
      setEditorMode("empty");
    });
  }, [runWithDirtyCheck]);

  const handleExportRules = async () => {
    if (!selectedFolderId) return;
    setRuleTransferError(null);
    setIsRuleExporting(true);
    try {
      const payload = await ruleExport(selectedFolderId);
      const defaultName = `${activeFolder?.name ?? "rules"}.filedispatch-rules.yaml`;
      const path = await save({
        defaultPath: defaultName,
        filters: [{ name: "File Dispatch Rules", extensions: ["filedispatch-rules", "yaml", "yml", "json"] }],
      });
      if (!path) return;
      await writeTextFile(path, payload);
    } catch (err) {
      setRuleTransferError(`Export failed: ${String(err)}`);
    } finally {
      setIsRuleExporting(false);
    }
  };

  const handleImportRules = async () => {
    if (!selectedFolderId) return;
    setRuleTransferError(null);
    setIsRuleImporting(true);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "File Dispatch Rules", extensions: ["filedispatch-rules", "yaml", "yml", "json"] }],
      });
      if (!selected || Array.isArray(selected)) return;
      const payload = await readTextFile(String(selected));
      const normalizedPayload = normalizeRuleImportPayload(payload);
      await ruleImport(selectedFolderId, normalizedPayload);
      await loadRules(selectedFolderId);
    } catch (err) {
      setRuleTransferError(`Import failed: ${String(err)}`);
    } finally {
      setIsRuleImporting(false);
    }
  };

  const isMagi = settings.theme === "magi";
  const isLinear = !isMagi;

  const commands = useMemo(() => ([
    {
      id: "new-rule",
      label: "New Rule",
      keywords: ["rule", "create"],
      shortcut: "Ctrl/Cmd+N",
      disabled: !selectedFolderId,
      action: handleNewRule,
    },
    {
      id: "open-templates",
      label: "Open Templates",
      keywords: ["template", "gallery"],
      action: () => setIsGalleryOpen(true),
    },
    {
      id: "rule-status",
      label: "Rule Status",
      keywords: ["engine", "status", "health"],
      action: () => setIsStatusOpen(true),
    },
    {
      id: "open-settings",
      label: "Open Settings",
      keywords: ["preferences"],
      shortcut: "Ctrl/Cmd+,",
      action: () => setIsSettingsOpen(true),
    },
    {
      id: "toggle-pause",
      label: engineStatus?.status.paused ? "Resume Processing" : "Pause Processing",
      keywords: ["pause", "resume"],
      action: () => void togglePaused(),
    },
    {
      id: "toggle-dry-run",
      label: settings.dryRun ? "Disable Dry Run" : "Enable Dry Run",
      keywords: ["dry", "simulate"],
      action: () => {
        useSettingsStore.getState().setSettings({ dryRun: !settings.dryRun });
        void useSettingsStore.getState().saveSettings();
      },
    },
  ]), [engineStatus?.status.paused, handleNewRule, selectedFolderId, settings.dryRun, togglePaused]);

  return (
    <div
      className="h-screen w-screen bg-[var(--bg-app)] text-[var(--fg-primary)] overflow-hidden flex flex-col hex-bg transition-colors duration-300"
      style={{ fontFamily: "var(--font-stack)" }}
    >
      {/* Hazel 6-style Unified Toolbar */}
      <header className={`h-11 bg-[var(--bg-header)] flex items-center shrink-0 relative z-10 transition ${isLinear ? "border-b border-[var(--border-main)]" : "border-b-4 border-[var(--border-main)] shadow-[0_0_15px_var(--border-main)]"
        }`}>
        {/* Folder Management Group - aligned with Folders pane */}
        <div className="w-[220px] flex items-center gap-1 px-3">
          <AddFolderDialog
            className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
              ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
              : "text-[var(--fg-primary)] border border-transparent hover:border-[var(--fg-primary)] hover:bg-[var(--bg-panel)]"
              }`}
            label=""
            showIcon
            icon={<AddFolderIcon className="h-4 w-4" />}
          />

          <AddGroupDialog
            trigger={
              <button
                className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
                  ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                  : "text-[var(--fg-primary)] border border-transparent hover:border-[var(--fg-primary)] hover:bg-[var(--bg-panel)]"
                  }`}
                title="New Group"
              >
                <AddGroupIcon className="h-4 w-4" />
                <span className="sr-only">New Group</span>
              </button>
            }
          />

          {/* Folder Settings - opens options for selected folder */}
          {activeFolder && !activeFolder.isGroup ? (
            <FolderOptionsDialog
              folder={activeFolder}
              trigger={
                <button
                  className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
                    ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                    : "text-[var(--fg-primary)] border border-transparent hover:border-[var(--fg-primary)] hover:bg-[var(--bg-panel)]"
                    }`}
                  title="Folder Settings"
                  aria-label="Folder settings"
                >
                  <FolderCog className="h-4 w-4" />
                </button>
              }
            />
          ) : (
            <button
              className={`flex items-center justify-center p-1.5 rounded transition-colors opacity-40 cursor-not-allowed ${isLinear
                ? "text-[var(--fg-secondary)]"
                : "text-[var(--fg-primary)]"
                }`}
              title={activeFolder?.isGroup ? "Settings not available for groups" : "Select a folder"}
              disabled
              aria-label="Folder settings unavailable"
            >
              <FolderCog className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Rule Operations Group - aligned with Rules pane */}
        <div className="w-[280px] flex items-center gap-1 px-3 border-l border-[var(--border-main)]">
          <button
            onClick={() => setIsGalleryOpen(true)}
            disabled={!selectedFolderId}
            className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
              ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] disabled:opacity-40 disabled:hover:bg-transparent"
              : "text-[var(--fg-primary)] hover:text-[var(--fg-alert)] disabled:opacity-40"
              }`}
            title="Templates"
            aria-label="Open template gallery"
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
            aria-label="Create new rule"
          >
            <FilePlus className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <button
            onClick={handleExportRules}
            disabled={!selectedFolderId || isRuleExporting || isRuleImporting}
            className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
              ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] disabled:opacity-40 disabled:hover:bg-transparent"
              : "text-[var(--fg-primary)] disabled:opacity-40"
              }`}
            title="Export Rules"
            aria-label="Export rules"
          >
            <FileDown className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <button
            onClick={handleImportRules}
            disabled={!selectedFolderId || isRuleImporting || isRuleExporting}
            className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
              ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] disabled:opacity-40 disabled:hover:bg-transparent"
              : "text-[var(--fg-primary)] disabled:opacity-40"
              }`}
            title="Import Rules"
            aria-label="Import rules"
          >
            <FileUp className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <button
            className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
              ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] disabled:opacity-40 disabled:hover:bg-transparent"
              : "text-[var(--fg-primary)] disabled:opacity-40"
              }`}
            title="Rule Status"
            onClick={() => setIsStatusOpen(true)}
            aria-label="Open rule status"
          >
            <Activity className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <PresetImportDialog
            folderId={selectedFolderId ?? ""}
            disabled={!selectedFolderId}
            trigger={
              <button
                className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
                  ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] disabled:opacity-40 disabled:hover:bg-transparent"
                  : "text-[var(--fg-primary)] disabled:opacity-40"
                  }`}
                title="Import Preset"
                aria-label="Import preset"
              >
                <FileSearch className="h-4 w-4" strokeWidth={1.5} />
              </button>
            }
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: Global Controls (Search, Activity Log, Stats, Settings) */}
        <div className="flex items-center gap-1 px-3">
          {/* Search */}
          {isSearchOpen ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter rules…"
                autoFocus
                className="h-6 w-40 px-2 text-xs bg-[var(--bg-panel)] border border-[var(--border-main)] rounded text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent)]"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsSearchOpen(false);
                    setSearchQuery("");
                  }
                }}
                aria-label="Filter rules"
              />
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }}
                className="flex items-center justify-center p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                aria-label="Clear search"
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
              aria-label="Search rules"
            >
              <Search className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}

          {/* Activity Log Toggle */}
          <button
            onClick={() => setIsLogExpanded(!isLogExpanded)}
            className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLogExpanded ? "bg-[var(--bg-subtle)] text-[var(--fg-primary)]" : "text-[var(--fg-secondary)]"
              } hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]`}
            title="Activity Log"
            aria-label="Toggle activity log"
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
            <button
              className={`flex items-center justify-center p-1.5 rounded transition-colors ${isLinear
              ? "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
              : "text-[var(--fg-primary)] hover:text-[var(--fg-alert)]"
              }`}
              aria-label="Open settings"
            >
              <Settings className="h-4 w-4" strokeWidth={1.5} />
            </button>
          } open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
        </div>
      </header>

      {/* Main Content Area - Grid Layout */}
      <div className={`flex-1 flex min-h-0 bg-[var(--bg-app)]/50 ${isLinear ? "gap-0" : "p-4 gap-4"
        }`}>

        {/* Pane 1: Folders */}
        <aside
          style={{ width: `${paneWidths.folders}px` }}
          className={`flex flex-col relative transition duration-300 ${isLinear ? "bg-[var(--bg-panel)] border-r border-[var(--border-main)]" : "magi-border bg-black"
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
        <div
          className="w-1 cursor-col-resize bg-transparent hover:bg-[var(--border-main)]"
          onMouseDown={startResize("folders")}
          aria-hidden="true"
        />

        <section
          style={{ width: `${paneWidths.rules}px` }}
          className={`flex flex-col relative transition duration-300 ${isLinear ? "bg-[var(--bg-panel)] border-r border-[var(--border-main)]" : "magi-border bg-[var(--bg-panel)]"
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

          {ruleTransferError ? (
            <div className="px-3 py-1 text-[10px] text-[var(--fg-alert)] border-b border-[var(--border-main)] bg-[var(--bg-subtle)]/60">
              {ruleTransferError}
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto relative p-1.5 custom-scrollbar">
            <RuleList
              selectedRuleId={effectiveRule?.id ?? ""}
              onNewRule={handleNewRule}
              onSelectRule={handleSelectRule}
              searchQuery={deferredSearchQuery}
            />
          </div>
        </section>

        {/* Pane 3: Editor */}
        <div
          className="w-1 cursor-col-resize bg-transparent hover:bg-[var(--border-main)]"
          onMouseDown={startResize("rules")}
          aria-hidden="true"
        />

        <section className={`flex-1 flex flex-col min-w-0 relative transition duration-300 ${isLinear ? "bg-[var(--bg-app)]" : "magi-border bg-[var(--bg-panel)]"
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
        className={`transition duration-300 ease-in-out border-t border-[var(--border-main)] bg-[var(--bg-panel)] ${isLogExpanded
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
            <button
              type="button"
              className="flex items-center justify-between px-3 h-full w-full text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)]"
              onClick={() => setIsLogExpanded(true)}
              aria-label="Expand activity log"
            >
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3" />
                <span>Activity Log</span>
              </div>
              {logs.length > 0 && (
                <span>Last: {logs[0].filePath.split(/[\\/]/).pop()} ({logs[0].status})</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Template Gallery Modal */}
      <TemplateGallery
        folderId={selectedFolderId ?? ""}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
      />
      <RuleStatusDialog
        open={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
      />
      <ConfirmDialog
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          useEditorStore.getState().setDirty(false);
          const action = pendingActionRef.current;
          pendingActionRef.current = null;
          action?.();
        }}
        title="Discard changes?"
        message="You have unsaved changes. Discard them and continue?"
        confirmLabel="Discard"
        variant="warning"
      />
      <ToastViewport />
      <CommandPalette items={commands} />
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
