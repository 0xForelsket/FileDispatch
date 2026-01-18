import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ScrollText, XCircle } from "lucide-react";

import { useLogStore } from "@/stores/logStore";
import type { LogEntry, LogStatus } from "@/types";

export function ActivityLog() {
  const entries = useLogStore((state) => state.entries);
  const clearLogs = useLogStore((state) => state.clearLogs);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LogStatus | "all">("all");
  const [ruleFilter, setRuleFilter] = useState<string>("all");

  const ruleOptions = useMemo(() => {
    const names = new Set<string>();
    entries.forEach((entry) => {
      if (entry.ruleName) names.add(entry.ruleName);
    });
    return Array.from(names).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesQuery =
        query.trim().length === 0 ||
        entry.filePath.toLowerCase().includes(query.toLowerCase()) ||
        entry.ruleName?.toLowerCase().includes(query.toLowerCase()) ||
        entry.actionType.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
      const matchesRule = ruleFilter === "all" || entry.ruleName === ruleFilter;
      return matchesQuery && matchesStatus && matchesRule;
    });
  }, [entries, query, ruleFilter, statusFilter]);

  const grouped = useMemo(() => groupByDate(filteredEntries), [filteredEntries]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Activity Log</h2>
        <button
          className="rounded-md border border-border px-3 py-1.5 text-sm"
          onClick={() => clearLogs()}
          type="button"
        >
          Clear Logs
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="relative flex-1">
          <input
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-border bg-transparent px-2 py-2 text-sm"
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
        <select
          className="rounded-md border border-border bg-transparent px-2 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LogStatus | "all")}
        >
          <option value="all">Status: All</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>
      <div className="space-y-2">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            <ScrollText className="h-5 w-5" />
            <div>
              <div className="font-medium text-foreground">No activity yet</div>
              <div className="text-xs text-muted-foreground">
                When files are processed by your rules, they&#39;ll appear here.
              </div>
            </div>
          </div>
        ) : (
          grouped.map(([label, items]) => (
            <div key={label} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </div>
              {items.map((entry) => (
                <div key={entry.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2">
                      {statusIcon(entry.status)}
                      <div>
                        <div className="font-medium">
                          {formatTime(entry.createdAt)} • {entry.filePath.split(/[/\\]/).pop()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.ruleName ?? "Rule"} → {entry.actionType}
                        </div>
                        {entry.errorMessage ? (
                          <div className="mt-1 text-xs text-destructive">
                            {entry.errorMessage}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{entry.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function statusIcon(status: LogStatus) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />;
    case "error":
      return <XCircle className="mt-0.5 h-4 w-4 text-destructive" />;
    case "skipped":
    default:
      return <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />;
  }
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function groupByDate(entries: LogEntry[]) {
  const map = new Map<string, LogEntry[]>();
  entries.forEach((entry) => {
    const date = new Date(entry.createdAt);
    const label = formatDateLabel(date);
    const group = map.get(label) ?? [];
    group.push(entry);
    map.set(label, group);
  });
  return Array.from(map.entries());
}

function formatDateLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const dateKey = date.toDateString();
  if (dateKey === today.toDateString()) return "Today";
  if (dateKey === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString();
}
