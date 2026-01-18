import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, Cpu, FileDigit, X } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import type { LogEntry } from "@/types";

const WINDOW_HOURS = 10;
const BUCKET_MS = 60 * 60 * 1000;

interface StatsModalProps {
  total: number;
  efficiency: number;
  savedBytes: number;
  activeRules: number;
  logs: LogEntry[];
}

export function StatsModal({
  total,
  efficiency,
  savedBytes,
  activeRules,
  logs,
}: StatsModalProps) {
  const [open, setOpen] = useState(false);

  const statusCounts = useMemo(() => {
    let success = 0;
    let error = 0;
    let skipped = 0;
    let deleted = 0;

    for (const entry of logs) {
      if (entry.status === "success") success += 1;
      if (entry.status === "error") error += 1;
      if (entry.status === "skipped") skipped += 1;
      if (entry.actionType === "delete" || entry.actionType === "deletePermanently") {
        deleted += 1;
      }
    }

    return { success, error, skipped, deleted };
  }, [logs]);

  const throughput = useMemo(() => {
    const buckets = Array.from({ length: WINDOW_HOURS }, () => 0);
    const timestamps: number[] = [];
    let latest = 0;

    for (const entry of logs) {
      const timestamp = Date.parse(entry.createdAt);
      if (!Number.isFinite(timestamp)) continue;
      timestamps.push(timestamp);
      if (timestamp > latest) latest = timestamp;
    }

    if (!latest) {
      return { heights: buckets, recent: 0 };
    }

    const windowMs = WINDOW_HOURS * BUCKET_MS;
    for (const timestamp of timestamps) {
      const diff = latest - timestamp;
      if (diff < 0 || diff > windowMs) continue;
      const bucketIndex = WINDOW_HOURS - 1 - Math.floor(diff / BUCKET_MS);
      if (bucketIndex >= 0 && bucketIndex < buckets.length) {
        buckets[bucketIndex] += 1;
      }
    }

    const max = Math.max(1, ...buckets);
    const heights = buckets.map((count) => Math.round((count / max) * 100));
    const recent = buckets.reduce((sum, count) => sum + count, 0);

    return { heights, recent };
  }, [logs]);

  const efficiencyValue = Number.isFinite(efficiency) ? Math.min(Math.max(efficiency, 0), 100) : 0;
  const avgSaved = statusCounts.deleted > 0 ? savedBytes / statusCounts.deleted : 0;
  const totalLabel = total.toLocaleString();

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm dark:bg-black/40"
              onClick={() => setOpen(false)}
            />
            <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/20 bg-white/80 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#0f0f0f]/90">
              <div className="flex items-center justify-between border-b border-slate-200/50 p-6 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner dark:bg-cyan-500/10 dark:text-cyan-400">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                      Performance Stats
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-neutral-500">
                      Tracking {activeRules} active {activeRules === 1 ? "rule" : "rules"} and {totalLabel} events.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-white"
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="custom-scrollbar max-h-[70vh] overflow-y-auto p-6">
                <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <GlassCard className="flex h-36 flex-col justify-between p-5" hoverEffect>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                          Throughput
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-800 dark:text-white">
                          {totalLabel} <span className="text-sm font-normal text-slate-500">files</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-neutral-500">
                          {throughput.recent} in the last {WINDOW_HOURS}h window
                        </div>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-cyan-500/10 dark:text-cyan-400">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-3 flex h-8 items-end gap-1">
                      {throughput.heights.map((height, index) => (
                        <div
                          key={`bar-${index}`}
                          className="flex-1 rounded-sm bg-blue-200/50 transition-colors hover:bg-blue-400 dark:bg-cyan-500/20 dark:hover:bg-cyan-400"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </GlassCard>

                  <GlassCard className="flex h-36 flex-col justify-between p-5" hoverEffect>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                          Efficiency
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-800 dark:text-white">
                          {efficiencyValue.toFixed(0)}%
                        </div>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <Cpu className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-auto">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
                          style={{ width: `${efficiencyValue}%` }}
                        />
                      </div>
                      <div className="mt-2 text-[10px] text-slate-400 dark:text-neutral-500">
                        {statusCounts.success} success · {statusCounts.error} error · {statusCounts.skipped} skipped
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard className="flex h-36 flex-col justify-between p-5" hoverEffect>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                          Storage Saved
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-800 dark:text-white">
                          {formatBytes(savedBytes)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                        <FileDigit className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-auto flex flex-col text-[11px] text-slate-500 dark:text-neutral-500">
                      <span>{statusCounts.deleted} deletions recorded</span>
                      <span>{avgSaved ? `${formatBytes(avgSaved)} avg per delete` : "No deletions yet"}</span>
                    </div>
                  </GlassCard>
                </section>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex h-10 items-center gap-2 rounded-xl border border-white/40 bg-white/40 px-3 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:scale-105 hover:bg-white/70 hover:text-slate-900 hover:shadow-lg dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
        type="button"
      >
        <BarChart3 className="h-4 w-4 text-blue-600 transition-colors group-hover:text-blue-700 dark:text-cyan-400 dark:group-hover:text-cyan-300" />
        Stats
      </button>
      {modal}
    </>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
