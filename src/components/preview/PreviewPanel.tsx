import { useRef } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Eye, X, XCircle } from "lucide-react";

import type { PreviewItem } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface PreviewPanelProps {
  open: boolean;
  onClose: () => void;
  results: PreviewItem[];
  loading: boolean;
  error: string | null;
  ruleName: string;
  conditionLabels?: string[];
}

export function PreviewPanel({ open, onClose, results, loading, error, ruleName, conditionLabels = [] }: PreviewPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef);

  if (!open) return null;

  const matched = results.filter((item) => item.matched).length;
  const unmatched = results.length - matched;

  const modal =
    typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={onClose}
            />
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="preview-panel-title"
              className="relative w-full max-w-5xl overflow-hidden rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-main)] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--accent)]">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id="preview-panel-title" className="text-xl font-semibold text-[var(--fg-primary)]">
                      Preview Results
                    </h2>
                    <p className="text-sm text-[var(--fg-muted)]">
                      Testing “{ruleName}”
                    </p>
                  </div>
                </div>
                <button
                  className="rounded-[var(--radius)] p-2 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                  onClick={onClose}
                  type="button"
                  aria-label="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="custom-scrollbar max-h-[70vh] overflow-y-auto p-6">
                {loading ? (
                  <div className="rounded-[var(--radius)] border border-dashed border-[var(--border-main)] bg-[var(--bg-subtle)] p-6 text-sm text-[var(--fg-muted)]">
                    Loading preview…
                  </div>
                ) : error ? (
                  <div className="rounded-[var(--radius)] border border-[var(--fg-alert)] bg-[var(--fg-alert)]/10 p-6">
                    <div className="text-sm font-semibold text-[var(--fg-alert)] mb-2">
                      Preview Failed
                    </div>
                    <div className="text-sm text-[var(--fg-primary)]">
                      {error}
                    </div>
                  </div>
                ) : results.length === 0 ? (
                  <div className="rounded-[var(--radius)] border border-dashed border-[var(--border-main)] bg-[var(--bg-subtle)] p-6 text-sm text-[var(--fg-muted)]">
                    No matching files.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3 text-xs font-semibold">
                      <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-muted)] px-3 py-1 text-[var(--fg-primary)]">
                        ✓ {matched} match
                      </span>
                      <span className="rounded-full border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-1 text-[var(--fg-muted)]">
                        ✗ {unmatched} no match
                      </span>
                      {results.length >= 50 && (
                        <span className="rounded-full border border-[var(--fg-alert)] bg-[var(--fg-alert)]/10 px-3 py-1 text-[var(--fg-alert)]">
                          ⚠ Limited to 50 files
                        </span>
                      )}
                    </div>
                    {results.map((item) => (
                      <GlassCard key={item.filePath} className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            {item.matched ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
                            ) : (
                              <XCircle className="mt-0.5 h-4 w-4 text-[var(--fg-muted)]" />
                            )}
                            <div className="space-y-2">
                              <div className="text-sm font-semibold text-[var(--fg-primary)]">
                                {item.filePath.split(/[/\\]/).pop()}
                              </div>
                              <div className="grid gap-1 text-[11px] text-[var(--fg-muted)]">
                                {item.conditionResults.map((passed, index) => {
                                  const label = conditionLabels[index] ?? `Condition ${index + 1}`;
                                  return (
                                    <div key={index}>
                                      {passed ? "✓" : "✗"} {label}
                                    </div>
                                  );
                                })}
                              </div>
                              {item.actions.length > 0 ? (
                                <div className="space-y-1 text-[11px] text-[var(--fg-muted)]">
                                  {item.actions.map((action, idx) => (
                                    <div key={idx}>→ {action}</div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <span
                            className={`text-xs font-semibold ${
                              item.matched
                                ? "text-[var(--accent)]"
                                : "text-[var(--fg-muted)]"
                            }`}
                          >
                            {item.matched ? "Matched" : "No match"}
                          </span>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return modal;
}
