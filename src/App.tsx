import { useMemo, useState } from "react";
import { Folder, MoreHorizontal } from "lucide-react";

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
import type { Rule } from "@/types";

const copper = "text-[#c07a46]";

function App() {
  useFolders();
  useRules();
  useLogs();

  const folders = useFolderStore((state) => state.folders);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const rules = useRuleStore((state) => state.rules);
  const logs = useLogStore((state) => state.entries);

  const [editorMode, setEditorMode] = useState<"empty" | "new" | "edit">("empty");
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

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
    <div className="dark h-screen w-screen bg-[#0c0d0f] text-[#e7e1d8]">
      <div className="flex h-full flex-col font-sans">
        <header className="flex h-11 items-center justify-between border-b border-[#1f1f24] px-4">
          <div className="flex items-center gap-3 text-sm font-semibold tracking-wide">
            <span className="h-2.5 w-2.5 rounded-full bg-[#c07a46] shadow-[0_0_10px_rgba(192,122,70,0.45)]" />
            File Dispatch
            {activeFolder ? (
              <span className="ml-4 flex items-center gap-2 rounded-full border border-[#2a2b31] bg-[#121316] px-2.5 py-0.5 text-[11px] font-medium text-[#a8a39b]">
                <Folder className="h-3 w-3" />
                {activeFolder.name}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <StatsModal
              total={stats.total}
              efficiency={stats.efficiency}
              savedBytes={stats.savedBytes}
              activeRules={rules.filter((rule) => rule.enabled).length}
              logs={activeLogs}
            />
            <SettingsDialog compact />
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[#8c8780] transition-colors hover:border-[#2a2b31] hover:text-[#cfc9bf]"
              type="button"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="flex w-[240px] flex-col border-r border-[#1f1f24] bg-[#0f1012]">
            <div className="flex items-center justify-between border-b border-[#1f1f24] px-3 py-3">
              <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${copper}`}>
                Folders
              </span>
              <AddFolderDialog
                className="inline-flex items-center gap-1 rounded-md border border-[#2a2b31] bg-[#15171a] px-2 py-1 text-[11px] font-semibold text-[#cfc9bf] transition-colors hover:border-[#3a3b42]"
                label="Add"
                showIcon={false}
              />
            </div>
            <FolderList />
          </aside>

          <section className="flex w-[300px] flex-col border-r border-[#1f1f24] bg-[#111214]">
            <RuleList
              selectedRuleId={effectiveRule?.id ?? ""}
              onNewRule={handleNewRule}
              onSelectRule={handleSelectRule}
            />
          </section>

          <section className="flex min-w-0 flex-1 flex-col bg-[#0e0f11]">
            <RuleEditor
              mode={effectiveMode}
              onClose={handleCloseEditor}
              folderId={selectedFolderId ?? ""}
              rule={effectiveRule}
            />
          </section>
        </div>

        <div className="h-56 border-t border-[#1f1f24] bg-[#0f1012]">
          <ActivityLog />
        </div>
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
