import { useMemo, useState } from "react";
import { Activity, ArrowRight, Search } from "lucide-react";

import { useLogStore } from "@/stores/logStore";
import type { LogEntry, LogStatus } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";

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

  return (
    <section className="pb-8">
      <div className="mb-6 flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-900 drop-shadow-sm dark:text-neutral-200">
          <Activity className="h-4 w-4 text-blue-600 dark:text-cyan-500" />
          Event Stream
        </h3>
        <div className="flex gap-2">
          <div className="group relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 transition-colors group-focus-within:text-blue-500 dark:text-neutral-500 dark:group-focus-within:text-cyan-400" />
            <input
              className="w-48 rounded-xl border border-white/40 bg-white/40 py-1.5 pl-9 pr-4 text-xs font-mono text-slate-700 shadow-sm backdrop-blur-sm transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white/60 focus:outline-none dark:border-white/10 dark:bg-black/20 dark:text-neutral-300 dark:placeholder:text-neutral-600 dark:focus:border-cyan-500/50 dark:focus:bg-black/40"
              placeholder="Filter events..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="rounded-xl border border-white/40 bg-white/40 px-2 py-1.5 text-xs text-slate-600 shadow-sm backdrop-blur-sm focus:outline-none dark:border-white/10 dark:bg-black/20 dark:text-neutral-400"
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
            className="rounded-xl border border-white/40 bg-white/40 px-2 py-1.5 text-xs text-slate-600 shadow-sm backdrop-blur-sm focus:outline-none dark:border-white/10 dark:bg-black/20 dark:text-neutral-400"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LogStatus | "all")}
          >
            <option value="all">Status: All</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="flex items-center border-b border-black/5 bg-white/40 px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/5 dark:text-neutral-500">
          <div className="w-32">Timestamp</div>
          <div className="w-28">Status</div>
          <div className="flex-1">File Operation</div>
          <div className="w-24 text-right">Size</div>
        </div>

        <div className="divide-y divide-black/5 font-mono text-xs dark:divide-white/5">
          {filteredEntries.length === 0 ? (
            <div className="px-6 py-6 text-center text-xs text-slate-500 dark:text-neutral-500">
              No events yet.
            </div>
          ) : (
            filteredEntries.map((entry, index) => (
              <div
                key={entry.id}
                className="group flex items-center px-6 py-3.5 transition-colors hover:bg-blue-50/30 dark:hover:bg-cyan-900/10"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex w-32 items-center gap-2 text-slate-500 dark:text-neutral-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 transition-colors group-hover:bg-blue-400 dark:bg-neutral-700 dark:group-hover:bg-cyan-400" />
                  {formatTime(entry.createdAt)}
                </div>
                <div className="w-28">
                  <StatusPill status={entry.status} label={entry.actionType} />
                </div>
                <div className="flex-1 truncate pr-4 text-slate-600 transition-colors group-hover:text-slate-900 dark:text-neutral-400 dark:group-hover:text-white">
                  <span className="mr-2 select-none text-slate-400/60 dark:text-neutral-600">~/</span>
                  {formatDetail(entry)}
                </div>
                <div className="w-24 text-right text-slate-400 transition-colors group-hover:text-slate-600 dark:text-neutral-600 dark:group-hover:text-neutral-400">
                  —
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between border-t border-black/5 bg-white/30 px-6 py-2.5 text-[10px] text-slate-400 backdrop-blur-sm dark:border-white/5 dark:bg-white/5 dark:text-neutral-600">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            STREAM ACTIVE
          </div>
          <button
            className="group flex items-center gap-1 font-semibold uppercase tracking-wider transition-colors hover:text-blue-600 dark:hover:text-cyan-400"
            onClick={() => clearLogs()}
            type="button"
          >
            Clear History
            <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </GlassCard>
    </section>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDetail(entry: LogEntry) {
  const fileName = entry.filePath.split(/[/\\]/).pop() ?? entry.filePath;
  if (entry.ruleName) {
    return `${fileName} → ${entry.ruleName}`;
  }
  return `${fileName} → ${entry.actionType}`;
}

function StatusPill({ status, label }: { status: LogStatus; label: string }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center rounded border border-emerald-200/50 bg-emerald-100/50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
        {label.toUpperCase()}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center rounded border border-rose-200/50 bg-rose-100/50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
        {label.toUpperCase()}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-amber-200/50 bg-amber-100/50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
      {label.toUpperCase()}
    </span>
  );
}
