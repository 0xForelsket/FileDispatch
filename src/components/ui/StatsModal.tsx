import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3 } from "lucide-react";

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

  /* ... (imports and logic same) ... */

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
  const totalLabel = total.toLocaleString();

  /* ... inside StatsModal component ... */
  
  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-mono text-[var(--fg-primary)]">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md hex-bg" onClick={() => setOpen(false)} />
            <div className="relative w-full max-w-5xl overflow-hidden magi-border bg-black shadow-[0_0_30px_rgba(255,157,0,0.3)]">
              
              {/* Header */}
              <div className="flex items-center justify-between bg-[var(--fg-primary)] px-4 py-2 select-none">
                <div className="flex items-center gap-4">
                  <div className="h-4 w-4 bg-black border border-white transform rotate-45" />
                  <span className="text-xl font-serif font-black text-black tracking-[0.2em] transform scale-y-110">MAGI ANALYTICS</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="bg-black text-[var(--fg-primary)] border border-black hover:bg-white hover:text-black hover:border-white px-2 py-0.5 font-bold"
                  type="button"
                >
                  TERMINATE
                </button>
              </div>

              <div className="p-6 bg-black grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                 {/* Decorative Grid Lines */}
                 <div className="absolute inset-0 pointer-events-none opacity-20 border-l border-r border-[var(--border-dim)] left-1/3 right-1/3" />

                 <div className="md:col-span-3 mb-2 flex items-center justify-between border-b border-[var(--border-dim)] pb-2">
                    <p className="text-xs text-[var(--fg-secondary)] tracking-widest uppercase">
                        SYSTEM STATUS: <span className="text-white font-bold ml-2">NORMAL</span>
                    </p>
                    <p className="text-xs text-[var(--border-dim)]">
                       ACTIVE PROTOCOLS: <span className="text-[var(--fg-primary)] font-bold">{activeRules}</span>
                    </p>
                 </div>

                {/* Card 1: Throughput */}
                <div className="magi-border-sm p-4 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 bg-[var(--fg-primary)] text-black text-[9px] font-bold px-1">DATA FLOW</div>
                   <div className="text-[10px] text-[var(--border-dim)] uppercase tracking-[0.2em] mb-4">throughput</div>
                   
                   <div className="text-4xl font-serif font-bold text-white mb-2">{totalLabel}</div>
                   <div className="flex items-end gap-1 h-12 mt-4">
                      {throughput.heights.map((height, index) => (
                          <div
                            key={`bar-${index}`}
                            className="flex-1 bg-[var(--fg-primary)]"
                            style={{ height: `${Math.max(10, height)}%`, opacity: 0.5 + (height/200) }}
                          />
                      ))}
                   </div>
                </div>

                {/* Card 2: Efficiency (Hexagon/Pie attempt or just Bar) */}
                <div className="magi-border-sm p-4 relative overflow-hidden">
                   <div className="absolute top-0 right-0 bg-[var(--fg-secondary)] text-black text-[9px] font-bold px-1">OPTIMIZATION</div>
                   <div className="text-[10px] text-[var(--border-dim)] uppercase tracking-[0.2em] mb-4">efficiency_ratio</div>
                   
                   <div className="text-4xl font-serif font-bold text-[var(--fg-secondary)] mb-2">{efficiencyValue.toFixed(0)}<span className="text-lg">%</span></div>
                   
                   <div className="w-full bg-[var(--border-dim)] h-4 mt-4 relative">
                      <div className="absolute inset-0 bg-[var(--fg-secondary)]" style={{ width: `${efficiencyValue}%` }} />
                      {/* Ticks */}
                      <div className="absolute inset-0 flex justify-between px-1">
                          {[0,25,50,75,100].map(t => <div key={t} className="w-[1px] h-full bg-black/50" />)}
                      </div>
                   </div>
                   <div className="flex justify-between text-[9px] mt-1 text-[var(--fg-secondary)] uppercase">
                      <span>SYNC: {statusCounts.success}</span>
                      <span className="text-[var(--fg-alert)]">ERR: {statusCounts.error}</span>
                   </div>
                </div>

                {/* Card 3: Storage */}
                <div className="magi-border-sm p-4 relative overflow-hidden">
                   <div className="absolute top-0 right-0 bg-white text-black text-[9px] font-bold px-1">RESOURCES</div>
                   <div className="text-[10px] text-[var(--border-dim)] uppercase tracking-[0.2em] mb-4">reclaimed_space</div>
                   
                   <div className="text-4xl font-serif font-bold text-white mb-2">{formatBytes(savedBytes)}</div>
                   <div className="mt-4 border-t border-[var(--border-dim)] pt-2 text-xs text-gray-400 font-mono">
                      DELETION_EVENTS: <span className="text-white">{statusCounts.deleted}</span>
                   </div>
                </div>

              </div>
              
              {/* Footer Decoration */}
              <div className="bg-[var(--fg-primary)] h-2 w-full flex gap-1 px-4 py-[1px]">
                  {Array.from({length: 20}).map((_, i) => (
                      <div key={i} className="h-full w-4 bg-black/50" />
                  ))}
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
        className="group flex items-center gap-2 px-2 py-1 border border-[var(--border-dim)] hover:bg-[var(--fg-primary)] hover:text-black text-xs font-mono text-[var(--fg-primary)] uppercase tracking-wider transition-colors"
        type="button"
      >
        <BarChart3 className="h-3 w-3" />
        STATUS
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
