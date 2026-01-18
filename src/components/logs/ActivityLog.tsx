import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowRight,
  ArrowRightLeft,
  Ban,
  Bell,
  Copy,
  Edit3,
  ExternalLink,
  FastForward,
  FolderTree,
  Pause,
  RotateCcw,
  Search,
  Skull,
  Terminal,
  Trash2,
} from "lucide-react";

import { useFolderStore } from "@/stores/folderStore";
import { useLogStore } from "@/stores/logStore";
import { useRuleStore } from "@/stores/ruleStore";
import type { LogEntry, LogStatus } from "@/types";

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
      <div className="flex items-center justify-between border-b border-[#1f1f24] px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c07a46]">
          <Activity className="h-3.5 w-3.5" />
          Event Stream
        </div>
        <div className="flex items-center gap-2">
          <div className="group relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#6f6a62] group-focus-within:text-[#c07a46]" />
            <input
              className="w-44 rounded-md border border-[#2a2b31] bg-[#141518] py-1 pl-8 pr-2 text-[11px] font-mono text-[#cfc9bf] outline-none transition focus:border-[#c07a46]"
              placeholder="Filter events"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="relative">
            <select
              className="appearance-none rounded-md border border-[#2a2b31] bg-[#141518] px-2 py-1 pr-6 text-[11px] font-semibold text-[#cfc9bf] outline-none transition focus:border-[#c07a46]"
              value={ruleFilter}
              onChange={(e) => setRuleFilter(e.target.value)}
            >
              <option value="all">Rule: All</option>
              {ruleOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#6f6a62]">
              ▾
            </span>
          </div>
          <div className="relative">
            <select
              className="appearance-none rounded-md border border-[#2a2b31] bg-[#141518] px-2 py-1 pr-6 text-[11px] font-semibold text-[#cfc9bf] outline-none transition focus:border-[#c07a46]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LogStatus | "all")}
            >
              <option value="all">Status: All</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="skipped">Skipped</option>
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#6f6a62]">
              ▾
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center border-b border-[#1f1f24] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#7f7a73]">
          <div className="w-24">Time</div>
          <div className="w-24">Status</div>
          <div className="flex-1">Action</div>
          <div className="w-20 text-right">Size</div>
          <div className="w-16 text-right">Undo</div>
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
                  className="group flex items-center border-b border-[#16171b] px-3 py-2 text-[11px] text-[#cfc9bf] hover:bg-[#15171a]"
                >
                  <div className="w-24 text-[#8c8780]">{formatTime(entry.createdAt)}</div>
                  <div className="w-24">
                    <StatusPill status={entry.status} label={entry.actionType} />
                  </div>
                  <div className="flex-1 pr-4">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded ${visual.className}`}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[#e7e1d8]">{formatOperation(entry)}</div>
                        <div className="mt-0.5 text-[10px] text-[#7f7a73]">
                          {formatRuleLabel(entry)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-20 text-right text-[#8c8780]">
                    {formatBytes(getSizeBytes(entry))}
                  </div>
                  <div className="w-16 text-right">
                    {undoByLog.has(entry.id) ? (
                      <button
                        className="inline-flex items-center gap-1 rounded border border-[#2a2b31] px-1.5 py-0.5 text-[10px] text-[#cfc9bf] hover:border-[#3a3b42]"
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
                      <span className="text-[10px] text-[#3a3b42]">—</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#1f1f24] px-3 py-2 text-[10px] text-[#7f7a73]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#c07a46]" />
          STREAM ACTIVE
        </div>
        <button
          className="group flex items-center gap-1 uppercase tracking-wider text-[#8c8780] transition-colors hover:text-[#cfc9bf]"
          onClick={() => clearLogs()}
          type="button"
        >
          Clear History
          <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
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
      <span className="inline-flex items-center rounded border border-[#1f2a22] bg-[#0f1713] px-1.5 py-0.5 text-[10px] font-semibold text-[#7ed19c]">
        {label.toUpperCase()}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center rounded border border-[#332021] bg-[#1a1112] px-1.5 py-0.5 text-[10px] font-semibold text-[#d28b7c]">
        {label.toUpperCase()}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-[#2a2b31] bg-[#141518] px-1.5 py-0.5 text-[10px] font-semibold text-[#9c958c]">
      {label.toUpperCase()}
    </span>
  );
}

function getActionVisual(actionType: string): { icon: LucideIcon; className: string } {
  switch (actionType) {
    case "move":
      return { icon: ArrowRightLeft, className: "bg-[#1a1a12] text-[#c07a46]" };
    case "copy":
      return { icon: Copy, className: "bg-[#19161f] text-[#b9a7d4]" };
    case "rename":
      return { icon: Edit3, className: "bg-[#15171a] text-[#a7a19a]" };
    case "sortIntoSubfolder":
      return { icon: FolderTree, className: "bg-[#1a1a12] text-[#c07a46]" };
    case "archive":
      return { icon: Archive, className: "bg-[#1a1512] text-[#c07a46]" };
    case "unarchive":
      return { icon: ArchiveRestore, className: "bg-[#1a1512] text-[#c07a46]" };
    case "delete":
      return { icon: Trash2, className: "bg-[#1a1212] text-[#d28b7c]" };
    case "deletePermanently":
      return { icon: Skull, className: "bg-[#1a1212] text-[#d28b7c]" };
    case "runScript":
      return { icon: Terminal, className: "bg-[#1a1712] text-[#d7b47c]" };
    case "notify":
      return { icon: Bell, className: "bg-[#121a14] text-[#7ed19c]" };
    case "open":
      return { icon: ExternalLink, className: "bg-[#15171a] text-[#a7a19a]" };
    case "pause":
      return { icon: Pause, className: "bg-[#15171a] text-[#a7a19a]" };
    case "continue":
      return { icon: FastForward, className: "bg-[#1a1a12] text-[#c07a46]" };
    case "undo":
      return { icon: RotateCcw, className: "bg-[#121a14] text-[#7ed19c]" };
    case "ignore":
      return { icon: Ban, className: "bg-[#15171a] text-[#a7a19a]" };
    default:
      return { icon: Activity, className: "bg-[#15171a] text-[#a7a19a]" };
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
