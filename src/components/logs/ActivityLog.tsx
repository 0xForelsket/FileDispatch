import { useCallback, useMemo, useRef, useState } from "react";
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
import { useVirtualizer } from "@tanstack/react-virtual";

import { useFolderStore } from "@/stores/folderStore";
import { useLogStore } from "@/stores/logStore";
import { useRuleStore } from "@/stores/ruleStore";
import type { LogEntry, LogStatus } from "@/types";
import { MagiSelect } from "@/components/ui/MagiSelect";

interface ActivityLogProps {
  onToggleExpand?: () => void;
  expanded?: boolean;
}

export function ActivityLog({ onToggleExpand, expanded = false }: ActivityLogProps) {
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

  // Virtualization
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 48, // Estimated row height in pixels
    overscan: 5, // Render 5 extra items above/below viewport
  });

  const handleUndo = useCallback((entryId: string) => {
    const undoEntry = undoByLog.get(entryId);
    if (undoEntry) {
      void undoAction(undoEntry.id);
    }
  }, [undoByLog, undoAction]);

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border-main)] bg-[var(--bg-panel)] px-4 py-3">
        <div className="flex items-center gap-3 text-[var(--fg-primary)]">
          <Activity className="h-5 w-5" />
          <span className="text-sm font-semibold">Activity log</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="group relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--fg-muted)] group-focus-within:text-[var(--fg-primary)]" />
            <input
              className="w-48 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] py-1 pl-8 pr-2 text-xs text-[var(--fg-primary)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
              placeholder="Search logs…"
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
                { label: "Rule: All", value: "all" },
                ...ruleOptions.map(name => ({ label: name, value: name }))
              ]}
              ariaLabel="Filter by rule"
            />
          </div>
          <div className="relative">
            <MagiSelect
               width="w-32"
               value={statusFilter}
               onChange={(val) => setStatusFilter(val as LogStatus | "all")}
               options={[
                  { label: "Status: All", value: "all" },
                  { label: "Success", value: "success" },
                  { label: "Error", value: "error" },
                  { label: "Skipped", value: "skipped" }
               ]}
               ariaLabel="Filter by status"
            />
          </div>
          {onToggleExpand ? (
            <button
              onClick={onToggleExpand}
              className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-xs font-semibold text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
              type="button"
            >
              {expanded ? "Minimize" : "Expand"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-panel)]">
        <div className="flex items-center border-b border-[var(--border-main)] bg-[var(--bg-subtle)] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-secondary)]">
          <div className="w-24">Time</div>
          <div className="w-24">Status</div>
          <div className="flex-1">Action</div>
          <div className="w-20 text-right">Size</div>
          <div className="w-20 text-right">Undo</div>
        </div>
        <div ref={scrollContainerRef} className="custom-scrollbar flex-1 overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[var(--fg-muted)]">
              No events yet.
            </div>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const entry = filteredEntries[virtualRow.index];
                const visual = getActionVisual(entry.actionType);
                const Icon = visual.icon;
                return (
                  <div
                    key={entry.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className="group flex items-center border-b border-[var(--border-main)] px-4 py-2 text-xs text-[var(--fg-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="w-24 font-semibold text-[var(--fg-secondary)]">{formatTime(entry.createdAt)}</div>
                    <div className="w-24">
                      <StatusPill status={entry.status} label={humanizeAction(entry.actionType)} />
                    </div>
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius)] border border-[var(--border-main)] ${visual.className}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex flex-col justify-center">
                          <div className="truncate font-semibold">{formatOperation(entry)}</div>
                          <div className="mt-0.5 text-[10px] text-[var(--fg-muted)]">
                            {formatRuleLabel(entry)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="w-20 text-right text-[var(--fg-secondary)] font-semibold">
                      {formatBytes(getSizeBytes(entry))}
                    </div>
                    <div className="w-20 text-right">
                      {undoByLog.has(entry.id) ? (
                        <button
                          className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border-main)] px-2 py-0.5 text-[10px] font-semibold text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                          onClick={() => handleUndo(entry.id)}
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
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border-main)] bg-[var(--bg-panel)] px-4 py-2 text-xs text-[var(--fg-secondary)]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="font-semibold">Stream active</span>
        </div>
        <button
          className="group flex items-center gap-2 rounded-[var(--radius)] px-2 py-0.5 font-semibold text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
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
      <span className="inline-flex items-center rounded-full border border-[var(--success)] bg-[var(--success)] px-2 py-0.5 text-[10px] font-semibold text-[var(--fg-inverse)]">
        {label}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--fg-alert)] bg-[var(--fg-alert)] px-2 py-0.5 text-[10px] font-semibold text-[var(--fg-inverse)]">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border-main)] px-2 py-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">
      {label}
    </span>
  );
}

function getActionVisual(actionType: string): { icon: LucideIcon; className: string } {
  const success = "text-[var(--success)]";
  const alert = "text-[var(--fg-alert)]";
  const dim = "text-[var(--fg-muted)]";
  const neutral = "text-[var(--fg-secondary)]";
  
  switch (actionType) {
    case "move":
    case "copy":
    case "rename":
    case "sortIntoSubfolder":
    case "continue":
        return { icon: ArrowRightLeft, className: neutral };
    case "delete":
    case "deletePermanently":
        return { icon: Trash2, className: alert };
    case "archive":
    case "unarchive":
        return { icon: Archive, className: neutral };
    case "runScript":
        return { icon: Terminal, className: success };
    case "notify":
        return { icon: Bell, className: success };
    case "pause":
    case "ignore":
        return { icon: Ban, className: dim };
    default:
        return { icon: Activity, className: neutral };
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
