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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl rounded-lg border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Preview: {ruleName}</h2>
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
            results.map((item) => (
              <div key={item.filePath} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.filePath}</span>
                  <span className={item.matched ? "text-emerald-600" : "text-muted-foreground"}>
                    {item.matched ? "Matched" : "No match"}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  {item.conditionResults.map((passed, index) => (
                    <div key={index}>{passed ? "✓" : "✗"} Condition {index + 1}</div>
                  ))}
                </div>
                {item.actions.length > 0 ? (
                  <div className="mt-2 text-xs">
                    {item.actions.map((action, idx) => (
                      <div key={idx}>{action}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
