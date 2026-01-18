import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  ArrowRight,
  ArrowRightLeft,
  Ban,
  Bell,
  RotateCcw,
  Search,
  Terminal,
  Trash2,
} from "lucide-react";

import { useFolderStore } from "@/stores/folderStore";
import { useLogStore } from "@/stores/logStore";
import { useRuleStore } from "@/stores/ruleStore";
import type { LogEntry, LogStatus } from "@/types";
import { MagiSelect } from "@/components/ui/MagiSelect";

export function ActivityLog() {
  const entries = useLogStore((state) => state.entries);
  const undoEntries = useLogStore((state) => state.undoEntries);
  const undoAction = useLogStore((state) => state.undoAction);
  const clearLogs = useLogStore((state) => state.clearLogs);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const rules = useRuleStore((state) => state.rules);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LogStatus | "all">("all");
  const [ruleFilter, setRuleFilter] = useState<string>("all");

  const scopedEntries = useMemo(() => {
    if (!selectedFolderId) return entries;
    const ruleIds = new Set(rules.map((rule) => rule.id));
    return entries.filter((entry) => entry.ruleId && ruleIds.has(entry.ruleId));
  }, [entries, rules, selectedFolderId]);

  const ruleOptions = useMemo(() => {
    const names = new Set<string>();
    scopedEntries.forEach((entry) => {
      if (entry.ruleName) names.add(entry.ruleName);
    });
    return Array.from(names).sort();
  }, [scopedEntries]);

  const filteredEntries = useMemo(() => {
    return scopedEntries.filter((entry) => {
      const matchesQuery =
        query.trim().length === 0 ||
        entry.filePath.toLowerCase().includes(query.toLowerCase()) ||
        entry.ruleName?.toLowerCase().includes(query.toLowerCase()) ||
        entry.actionType.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
      const matchesRule = ruleFilter === "all" || entry.ruleName === ruleFilter;
      return matchesQuery && matchesStatus && matchesRule;
    });
  }, [scopedEntries, query, ruleFilter, statusFilter]);

  const undoByLog = useMemo(() => {
    return new Map(undoEntries.map((entry) => [entry.logId, entry]));
  }, [undoEntries]);

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-main)] px-4 py-3 bg-black">
        <div className="flex items-center gap-3 text-[var(--fg-primary)]">
          <Activity className="h-5 w-5" />
          <span className="text-2xl uppercase eva-title tracking-normal">EVENT STREAM</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="group relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#6f6a62] group-focus-within:text-[#c07a46]" />
            <input
              className="w-48 rounded-none border border-[var(--border-dim)] bg-[var(--bg-panel)] py-1 pl-8 pr-2 text-xs font-mono font-bold text-[var(--fg-primary)] outline-none transition focus:border-[var(--fg-primary)] focus:bg-[var(--fg-primary)] focus:text-[var(--bg-panel)] placeholder:text-[var(--border-dim)]"
              placeholder="SEARCH LOGS..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="relative">
            <MagiSelect
              width="w-32"
              value={ruleFilter}
              onChange={(val) => setRuleFilter(val)}
              options={[
                { label: "RULE: ALL", value: "all" },
                ...ruleOptions.map(name => ({ label: name, value: name }))
              ]}
            />
          </div>
          <div className="relative">
            <MagiSelect
               width="w-32"
               value={statusFilter}
               onChange={(val) => setStatusFilter(val as LogStatus | "all")}
               options={[
                  { label: "STATUS: ALL", value: "all" },
                  { label: "SUCCESS", value: "success" },
                  { label: "ERROR", value: "error" },
                  { label: "SKIPPED", value: "skipped" }
               ]}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden bg-black/80">
        <div className="flex items-center border-b border-[var(--border-dim)] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[var(--fg-primary)] bg-black/50">
          <div className="w-24">Time</div>
          <div className="w-24">Status</div>
          <div className="flex-1">Action</div>
          <div className="w-20 text-right">Size</div>
          <div className="w-20 text-right">Undo</div>
        </div>
        <div className="custom-scrollbar flex-1 overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[#7f7a73]">
              No events yet.
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const visual = getActionVisual(entry.actionType);
              const Icon = visual.icon;
              return (
                <div
                  key={entry.id}
                  className="group flex items-center border-b border-[var(--border-dim)] border-dashed px-4 py-2 text-xs font-mono text-[var(--fg-primary)] hover:bg-[var(--fg-primary)] hover:text-black transition-colors"
                >
                  <div className="w-24 font-bold opacity-80 group-hover:opacity-100">{formatTime(entry.createdAt)}</div>
                  <div className="w-24">
                    <StatusPill status={entry.status} label={entry.actionType} />
                  </div>
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center border border-current ${visual.className}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex flex-col justify-center">
                        <div className="truncate font-bold uppercase">{formatOperation(entry)}</div>
                        <div className="text-[10px] opacity-70 group-hover:text-black mt-0.5">
                          {formatRuleLabel(entry)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-20 text-right font-bold opacity-80 group-hover:opacity-100">
                    {formatBytes(getSizeBytes(entry))}
                  </div>
                  <div className="w-20 text-right">
                    {undoByLog.has(entry.id) ? (
                      <button
                        className="inline-flex items-center gap-1 border border-current px-2 py-0.5 text-[10px] font-bold uppercase hover:bg-[var(--bg-panel)] hover:text-[var(--fg-primary)] transition-colors group-hover:border-[var(--bg-panel)]"
                        onClick={() => {
                          const undoEntry = undoByLog.get(entry.id);
                          if (undoEntry) {
                            void undoAction(undoEntry.id);
                          }
                        }}
                        type="button"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Undo
                      </button>
                    ) : (
                      <span className="text-[10px] opacity-30">—</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t-2 border-[var(--border-main)] px-4 py-2 text-xs font-mono text-[var(--fg-primary)] bg-[var(--bg-panel)]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-none bg-[var(--fg-secondary)] animate-pulse" />
          <span className="uppercase font-bold tracking-widest">STREAM ACTIVE</span>
        </div>
        <button
          className="group flex items-center gap-2 uppercase font-bold tracking-wider hover:bg-[var(--fg-primary)] hover:text-[var(--bg-panel)] px-2 py-0.5 transition-colors"
          onClick={() => clearLogs()}
          type="button"
        >
          Clear History
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </section>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatOperation(entry: LogEntry) {
  const fileName = entry.filePath.split(/[/\\]/).pop() ?? entry.filePath;
  const destination = entry.actionDetail?.destinationPath;
  const action = humanizeAction(entry.actionType);

  if (destination) {
    return `${action} → ${destination}`;
  }

  return `${action} → ${fileName}`;
}

function formatRuleLabel(entry: LogEntry) {
  if (entry.ruleName) {
    return `Rule: ${entry.ruleName}`;
  }
  if (entry.actionType === "undo") {
    return "Undo action";
  }
  return "Manual action";
}

function getSizeBytes(entry: LogEntry) {
  const value =
    entry.actionDetail?.metadata?.size_bytes ??
    entry.actionDetail?.metadata?.sizeBytes ??
    entry.actionDetail?.metadata?.["size-bytes"];
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function StatusPill({ status, label }: { status: LogStatus; label: string }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center border border-[var(--fg-secondary)] bg-[var(--fg-secondary)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--bg-panel)] uppercase tracking-wider group-hover:bg-[var(--bg-panel)] group-hover:text-[var(--fg-secondary)] transition-colors">
        {label.toUpperCase()}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center border border-[var(--fg-alert)] bg-[var(--fg-alert)] px-1.5 py-0.5 text-[10px] font-bold text-black uppercase tracking-wider group-hover:bg-black group-hover:text-[var(--fg-alert)] transition-colors">
        {label.toUpperCase()}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center border border-[var(--border-dim)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--border-dim)] uppercase tracking-wider group-hover:border-black group-hover:text-black transition-colors">
      {label.toUpperCase()}
    </span>
  );
}

function getActionVisual(actionType: string): { icon: LucideIcon; className: string } {
  // Simplify colors to strict MAGI palette
  const success = "text-[var(--fg-secondary)] group-hover:text-black";
  const alert = "text-[var(--fg-alert)] group-hover:text-black";
  const dim = "text-[var(--border-dim)] group-hover:text-black";
  const standard = "text-[var(--fg-primary)] group-hover:text-black";
  
  switch (actionType) {
    case "move":
    case "copy":
    case "rename":
    case "sortIntoSubfolder":
    case "continue":
        return { icon: ArrowRightLeft, className: standard };
    case "delete":
    case "deletePermanently":
        return { icon: Trash2, className: alert };
    case "archive":
    case "unarchive":
        return { icon: Archive, className: standard };
    case "runScript":
        return { icon: Terminal, className: success };
    case "notify":
        return { icon: Bell, className: success };
    case "pause":
    case "ignore":
        return { icon: Ban, className: dim };
    default:
        return { icon: Activity, className: standard };
  }
}

function humanizeAction(value: string) {
  switch (value) {
    case "move":
      return "Move";
    case "copy":
      return "Copy";
    case "rename":
      return "Rename";
    case "sortIntoSubfolder":
      return "Sort";
    case "archive":
      return "Archive";
    case "unarchive":
      return "Unarchive";
    case "delete":
      return "Trash";
    case "deletePermanently":
      return "Delete";
    case "runScript":
      return "Run Script";
    case "notify":
      return "Notify";
    case "open":
      return "Open";
    case "pause":
      return "Pause";
    case "continue":
      return "Continue";
    case "undo":
      return "Undo";
    case "ignore":
      return "Ignore";
    default:
      return value;
  }
}
