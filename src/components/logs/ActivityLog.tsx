import { useLogStore } from "@/stores/logStore";

export function ActivityLog() {
  const entries = useLogStore((state) => state.entries);
  const clearLogs = useLogStore((state) => state.clearLogs);

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
      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No activity yet.
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{entry.ruleName ?? "Rule"}</span>
                <span className="text-xs text-muted-foreground">{entry.status}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {entry.filePath} • {entry.actionType}
              </div>
              {entry.errorMessage ? (
                <div className="mt-1 text-xs text-destructive">{entry.errorMessage}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
