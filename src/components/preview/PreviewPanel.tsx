import { CheckCircle2, Eye, XCircle } from "lucide-react";

import type { PreviewItem } from "@/types";

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl rounded-lg border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Preview Results</h2>
              <p className="text-xs text-muted-foreground">Testing “{ruleName}”</p>
            </div>
          </div>
          <button className="text-sm text-muted-foreground" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading preview…</div>
          ) : results.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No matching files.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-emerald-600">✓ {matched} files would match</span>
                <span className="text-muted-foreground">✗ {unmatched} files would not match</span>
              </div>
              {results.map((item) => (
                <div key={item.filePath} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2">
                      {item.matched ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <div className="font-medium">
                          {item.filePath.split(/[/\\]/).pop()}
                        </div>
                        <div className="mt-1 grid gap-1 text-xs text-muted-foreground">
                          {item.conditionResults.map((passed, index) => (
                            <div key={index}>
                              {passed ? "✓" : "✗"} Condition {index + 1}
                            </div>
                          ))}
                        </div>
                        {item.actions.length > 0 ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {item.actions.map((action, idx) => (
                              <div key={idx}>→ {action}</div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <span className={item.matched ? "text-emerald-600" : "text-muted-foreground"}>
                      {item.matched ? "Matched" : "No match"}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
