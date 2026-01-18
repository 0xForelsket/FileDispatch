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
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="relative w-full max-w-5xl overflow-hidden rounded-md border border-[#2a2b31] bg-[#101113] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1f1f24] p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#1a1512] text-[#c07a46]">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#e7e1d8]">Performance Stats</h2>
                    <p className="text-[11px] text-[#7f7a73]">
                      Tracking {activeRules} active {activeRules === 1 ? "rule" : "rules"} and {totalLabel} events.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-[#8c8780] transition-colors hover:text-[#e7e1d8]"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="custom-scrollbar max-h-[70vh] overflow-y-auto p-5">
                <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <GlassCard className="flex h-36 flex-col justify-between p-4" hoverEffect>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-[#7f7a73]">
                          Throughput
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-[#e7e1d8]">
                          {totalLabel} <span className="text-sm font-normal text-[#7f7a73]">files</span>
                        </div>
                        <div className="mt-1 text-[11px] text-[#7f7a73]">
                          {throughput.recent} in the last {WINDOW_HOURS}h window
                        </div>
                      </div>
                      <div className="rounded-md bg-[#1a1512] p-2 text-[#c07a46]">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-3 flex h-8 items-end gap-1">
                      {throughput.heights.map((height, index) => (
                        <div
                          key={`bar-${index}`}
                          className="flex-1 rounded-sm bg-[#2a2b31] transition-colors hover:bg-[#c07a46]"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </GlassCard>

                  <GlassCard className="flex h-36 flex-col justify-between p-4" hoverEffect>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-[#7f7a73]">
                          Efficiency
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-[#e7e1d8]">
                          {efficiencyValue.toFixed(0)}%
                        </div>
                      </div>
                      <div className="rounded-md bg-[#121a14] p-2 text-[#7ed19c]">
                        <Cpu className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-auto">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2a2b31]">
                        <div
                          className="h-full rounded-full bg-[#7ed19c]"
                          style={{ width: `${efficiencyValue}%` }}
                        />
                      </div>
                      <div className="mt-2 text-[10px] text-[#7f7a73]">
                        {statusCounts.success} success · {statusCounts.error} error · {statusCounts.skipped} skipped
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard className="flex h-36 flex-col justify-between p-4" hoverEffect>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-[#7f7a73]">
                          Storage Saved
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-[#e7e1d8]">
                          {formatBytes(savedBytes)}
                        </div>
                      </div>
                      <div className="rounded-md bg-[#1a1512] p-2 text-[#c07a46]">
                        <FileDigit className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-auto flex flex-col text-[11px] text-[#7f7a73]">
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
        className="group flex h-8 items-center gap-2 rounded-md border border-transparent px-2 text-[11px] font-semibold text-[#8c8780] transition-colors hover:border-[#2a2b31] hover:text-[#d6d0c6]"
        type="button"
      >
        <BarChart3 className="h-4 w-4 text-[#c07a46] transition-colors group-hover:text-[#d38a52]" />
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
