import { createPortal } from "react-dom";
import { CheckCircle2, Eye, X, XCircle } from "lucide-react";

import type { PreviewItem } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";

interface PreviewPanelProps {
  open: boolean;
  onClose: () => void;
  results: PreviewItem[];
  loading: boolean;
  ruleName: string;
}

export function PreviewPanel({ open, onClose, results, loading, ruleName }: PreviewPanelProps) {
  if (!open) return null;

  const matched = results.filter((item) => item.matched).length;
  const unmatched = results.length - matched;

  const modal =
    typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <div
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm dark:bg-black/40"
              onClick={onClose}
            />
            <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/20 bg-white/80 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#0f0f0f]/90">
              <div className="flex items-center justify-between border-b border-slate-200/50 p-6 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-cyan-500/10 dark:text-cyan-400">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                      Preview Results
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-neutral-500">
                      Testing “{ruleName}”
                    </p>
                  </div>
                </div>
                <button
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={onClose}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="custom-scrollbar max-h-[70vh] overflow-y-auto p-6">
                {loading ? (
                  <div className="rounded-2xl border border-dashed border-white/40 bg-white/40 p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-500">
                    Loading preview…
                  </div>
                ) : results.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/40 bg-white/40 p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-500">
                    No matching files.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3 text-xs font-semibold">
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-100/60 px-3 py-1 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                        ✓ {matched} match
                      </span>
                      <span className="rounded-full border border-slate-300/40 bg-white/60 px-3 py-1 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
                        ✗ {unmatched} no match
                      </span>
                    </div>
                    {results.map((item) => (
                      <GlassCard key={item.filePath} className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            {item.matched ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                            ) : (
                              <XCircle className="mt-0.5 h-4 w-4 text-slate-400 dark:text-neutral-500" />
                            )}
                            <div className="space-y-2">
                              <div className="text-sm font-semibold text-slate-800 dark:text-neutral-200">
                                {item.filePath.split(/[/\\]/).pop()}
                              </div>
                              <div className="grid gap-1 text-[11px] text-slate-500 dark:text-neutral-500">
                                {item.conditionResults.map((passed, index) => (
                                  <div key={index}>
                                    {passed ? "✓" : "✗"} Condition {index + 1}
                                  </div>
                                ))}
                              </div>
                              {item.actions.length > 0 ? (
                                <div className="space-y-1 text-[11px] text-slate-500 dark:text-neutral-500">
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
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-400 dark:text-neutral-500"
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
