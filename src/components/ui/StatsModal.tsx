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
  trigger?: React.ReactNode;
}

/* ... (imports and logic same) ... */

export function StatsModal({
  total,
  efficiency,
  savedBytes,
  activeRules,
  logs,
  trigger,
}: StatsModalProps) {
  const [open, setOpen] = useState(false);

  // Combined single-pass calculation for status counts and throughput
  const { statusCounts, throughput } = useMemo(() => {
    // Status counts
    let success = 0;
    let error = 0;
    let skipped = 0;
    let deleted = 0;

    // Throughput calculation
    const buckets = Array.from({ length: WINDOW_HOURS }, () => 0);
    let latest = 0;

    // First pass: collect status counts and find latest timestamp
    for (const entry of logs) {
      // Status counts
      if (entry.status === "success") success += 1;
      else if (entry.status === "error") error += 1;
      else if (entry.status === "skipped") skipped += 1;

      if (entry.actionType === "delete" || entry.actionType === "deletePermanently") {
        deleted += 1;
      }

      // Find latest timestamp
      const timestamp = Date.parse(entry.createdAt);
      if (Number.isFinite(timestamp) && timestamp > latest) {
        latest = timestamp;
      }
    }

    // Second pass: bucket timestamps (only if we have a latest timestamp)
    if (latest) {
      const windowMs = WINDOW_HOURS * BUCKET_MS;
      for (const entry of logs) {
        const timestamp = Date.parse(entry.createdAt);
        if (!Number.isFinite(timestamp)) continue;
        const diff = latest - timestamp;
        if (diff < 0 || diff > windowMs) continue;
        const bucketIndex = WINDOW_HOURS - 1 - Math.floor(diff / BUCKET_MS);
        if (bucketIndex >= 0 && bucketIndex < buckets.length) {
          buckets[bucketIndex] += 1;
        }
      }
    }

    const max = Math.max(1, ...buckets);
    const heights = buckets.map((count) => Math.round((count / max) * 100));
    const recent = buckets.reduce((sum, count) => sum + count, 0);

    return {
      statusCounts: { success, error, skipped, deleted },
      throughput: { heights, recent },
    };
  }, [logs]);

  const efficiencyValue = Number.isFinite(efficiency) ? Math.min(Math.max(efficiency, 0), 100) : 0;
  const totalLabel = total.toLocaleString();

  /* ... inside StatsModal component ... */

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-5xl overflow-hidden rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between border-b border-[var(--border-main)] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Analytics</h2>
                <p className="text-xs text-[var(--fg-muted)]">Last {WINDOW_HOURS} hours</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--fg-muted)]">
                <span className="rounded-full border border-[var(--border-main)] bg-[var(--bg-subtle)] px-2 py-0.5">
                  Active rules: <span className="text-[var(--fg-primary)]">{activeRules}</span>
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-[var(--radius)] border border-[var(--border-main)] px-3 py-1 text-xs font-semibold text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-3">
              <div className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-4">
                <div className="text-[11px] font-semibold text-[var(--fg-secondary)]">Total events</div>
                <div className="mt-2 text-3xl font-semibold text-[var(--fg-primary)]">{totalLabel}</div>
                <div className="mt-1 text-[11px] text-[var(--fg-muted)]">
                  {throughput.recent} events in window
                </div>
                <div className="mt-4 flex h-12 items-end gap-1">
                  {throughput.heights.map((height, index) => (
                    <div
                      key={`bar-${index}`}
                      className="flex-1 rounded-full bg-[var(--accent)]"
                      style={{ height: `${Math.max(8, height)}%`, opacity: 0.4 + height / 200 }}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-4">
                <div className="text-[11px] font-semibold text-[var(--fg-secondary)]">Efficiency</div>
                <div className="mt-2 text-3xl font-semibold text-[var(--fg-primary)]">
                  {efficiencyValue.toFixed(0)}%
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--border-main)]">
                  <div
                    className="h-full bg-[var(--accent)]"
                    style={{ width: `${efficiencyValue}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-[var(--fg-muted)]">
                  <span>Success {statusCounts.success}</span>
                  <span className="text-[var(--fg-alert)]">Errors {statusCounts.error}</span>
                </div>
              </div>

              <div className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-4">
                <div className="text-[11px] font-semibold text-[var(--fg-secondary)]">Saved space</div>
                <div className="mt-2 text-3xl font-semibold text-[var(--fg-primary)]">{formatBytes(savedBytes)}</div>
                <div className="mt-2 text-[11px] text-[var(--fg-muted)]">
                  Deleted {statusCounts.deleted} files · Skipped {statusCounts.skipped}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
      : null;

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)} className="contents">
          {trigger}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-xs font-semibold text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
          type="button"
        >
          <BarChart3 className="h-3 w-3" />
          Analytics
        </button>
      )}
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
