import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, FileSearch, Pause, Play, RefreshCw, X } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import type { Rule } from "@/types";
import { previewFile } from "@/lib/tauri";
import { useEngineStore } from "@/stores/engineStore";
import { useFolderStore } from "@/stores/folderStore";
import { useRuleStore } from "@/stores/ruleStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { Switch } from "@/components/ui/Switch";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface RuleStatusDialogProps {
  open: boolean;
  onClose: () => void;
}

interface TestResult {
  rule: Rule;
  matched: boolean;
  actions: string[];
}

export function RuleStatusDialog({ open, onClose }: RuleStatusDialogProps) {
  const status = useEngineStore((state) => state.status);
  const loading = useEngineStore((state) => state.loading);
  const error = useEngineStore((state) => state.error);
  const loadStatus = useEngineStore((state) => state.loadStatus);
  const togglePaused = useEngineStore((state) => state.togglePaused);

  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const rules = useRuleStore((state) => state.rules);

  const settings = useSettingsStore((state) => state.settings);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const saveSettings = useSettingsStore((state) => state.saveSettings);

  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testFilePath, setTestFilePath] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const activeRules = useMemo(
    () => rules.filter((rule) => rule.enabled),
    [rules],
  );

  useFocusTrap(open, dialogRef);

  const handlePickFile = async () => {
    setTestError(null);
    setTestResults([]);
    const selected = await openDialog({
      multiple: false,
      title: "Select a file to test",
    });
    if (!selected || Array.isArray(selected)) return;

    if (!selectedFolderId) {
      setTestError("Select a folder first");
      return;
    }

    setTestFilePath(String(selected));
    setTestLoading(true);
    try {
      const previews = await Promise.all(
        activeRules.map((rule) =>
          previewFile(rule.id, String(selected)).then((result) => ({
            rule,
            matched: result.matched,
            actions: result.actions,
          })),
        ),
      );
      const sorted = previews.sort((a, b) => Number(b.matched) - Number(a.matched));
      setTestResults(sorted);
    } catch (err) {
      setTestError(String(err));
    } finally {
      setTestLoading(false);
    }
  };

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close status dialog"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-status-title"
        className="relative w-full max-w-4xl overflow-hidden rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-main)] px-6 py-4">
          <div>
            <h2 id="rule-status-title" className="text-lg font-semibold text-[var(--fg-primary)]">Rule status</h2>
            <p className="text-xs text-[var(--fg-muted)]">Engine state, watchers, and file testing</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius)] p-2 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
            aria-label="Close status dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <div className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                    Engine
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[var(--fg-primary)]">
                    {status?.status.paused ? "Paused" : "Running"}
                  </div>
                  <div className="mt-1 text-xs text-[var(--fg-muted)]">
                    Queue depth: {status?.status.queueDepth ?? 0} · Processed: {status?.status.processedCount ?? 0}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void togglePaused()}
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                >
                  {status?.status.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  {status?.status.paused ? "Resume" : "Pause"}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-[var(--fg-primary)]">Dry run</div>
                  <div className="text-xs text-[var(--fg-muted)]">Simulate actions without modifying files</div>
                </div>
                <Switch
                  checked={settings.dryRun}
                  onCheckedChange={(checked) => {
                    setSettings({ dryRun: checked });
                    void saveSettings();
                  }}
                  ariaLabel="Dry run"
                />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-[var(--fg-primary)]">Refresh status</div>
                  <div className="text-xs text-[var(--fg-muted)]">Fetch latest engine state</div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadStatus()}
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border-main)] px-2 py-1 text-xs font-semibold text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""} motion-reduce:animate-none`} />
                  Refresh
                </button>
              </div>

              {status?.status.lastEvent ? (
                <div className="mt-4 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2 text-xs text-[var(--fg-muted)]">
                  <div className="font-semibold text-[var(--fg-primary)]">Last event</div>
                  <div className="mt-1">{status.status.lastEvent.kind}</div>
                  <div className="mt-1 truncate">{status.status.lastEvent.path}</div>
                </div>
              ) : null}

              {status?.status.lastError ? (
                <div className="mt-3 flex items-start gap-2 rounded-[var(--radius)] border border-[var(--fg-alert)]/30 bg-[var(--fg-alert)]/10 px-3 py-2 text-xs text-[var(--fg-alert)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">Last error</div>
                    <div>{status.status.lastError.message}</div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="mt-3 text-xs text-[var(--fg-alert)]">{error}</div>
              ) : null}
            </div>

            <div className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                Watched folders
              </div>
              <div className="mt-3 space-y-2 text-xs text-[var(--fg-secondary)]">
                {status?.watchedFolders.length ? (
                  status.watchedFolders.map((folder) => (
                    <div key={`${folder.folderId}-${folder.path}`} className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1">
                      <div className="truncate text-[var(--fg-primary)]">{folder.path}</div>
                      <div className="text-[10px] text-[var(--fg-muted)]">Depth: {folder.scanDepth}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-[var(--fg-muted)]">No watched folders yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  Test a file
                </div>
                <div className="mt-1 text-xs text-[var(--fg-muted)]">
                  Check which rules match a selected file
                </div>
              </div>
              <button
                type="button"
                onClick={handlePickFile}
                className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
              >
                <FileSearch className="h-3.5 w-3.5" />
                Select file
              </button>
            </div>

            {testFilePath ? (
              <div className="mt-3 truncate rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2 text-xs text-[var(--fg-muted)]">
                {testFilePath}
              </div>
            ) : null}

            {testLoading ? (
              <div className="mt-3 text-xs text-[var(--fg-muted)]">Testing rules…</div>
            ) : null}

            {testError ? (
              <div className="mt-3 text-xs text-[var(--fg-alert)]">{testError}</div>
            ) : null}

            {testResults.length > 0 ? (
              <div className="mt-4 space-y-2 text-xs">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  Results
                </div>
                {testResults.map((result) => (
                  <div
                    key={result.rule.id}
                    className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--fg-primary)]">{result.rule.name}</span>
                      <span className={result.matched ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"}>
                        {result.matched ? "Matched" : "No match"}
                      </span>
                    </div>
                    {result.actions.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-[10px] text-[var(--fg-muted)]">
                        {result.actions.map((action, index) => (
                          <li key={`${result.rule.id}-action-${index}`}>{action}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-2 text-[10px] text-[var(--fg-muted)]">No actions</div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : modal;
}
