import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react";

import type { Condition, ConditionGroup, Rule } from "@/types";
import { useRuleStore } from "@/stores/ruleStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { ActionBuilder } from "@/components/rules/ActionBuilder";
import { ConditionBuilder } from "@/components/rules/ConditionBuilder";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { previewRuleDraft } from "@/lib/tauri";
import { matchesShortcut } from "@/lib/shortcuts";
import type { PreviewItem } from "@/types";

interface RuleEditorProps {
  mode: "empty" | "new" | "edit";
  onClose: () => void;
  folderId: string;
  rule: Rule | null;
  onNewRule?: () => void;
}

const emptyConditions: ConditionGroup = {
  matchType: "all",
  conditions: [],
};

function createEmptyRule(folderId: string): Rule {
  const now = new Date().toISOString();
  return {
    id: "",
    folderId,
    name: "New Rule",
    enabled: true,
    stopProcessing: true,
    conditions: emptyConditions,
    actions: [],
    position: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function RuleEditor({ mode, onClose, folderId, rule, onNewRule }: RuleEditorProps) {
  const createRule = useRuleStore((state) => state.createRule);
  const updateRule = useRuleStore((state) => state.updateRule);
  const deleteRule = useRuleStore((state) => state.deleteRule);
  const theme = useSettingsStore((state) => state.settings.theme);
  const previewMaxFiles = useSettingsStore((state) => state.settings.previewMaxFiles);
  const isMagi = theme === "magi";

  const [draft, setDraft] = useState<Rule>(() => rule ?? createEmptyRule(folderId));
  const [showPreview, setShowPreview] = useState(false);
  const [previewResults, setPreviewResults] = useState<PreviewItem[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Live preview state
  const [livePreviewResults, setLivePreviewResults] = useState<PreviewItem[]>([]);
  const [livePreviewLoading, setLivePreviewLoading] = useState(false);
  const [livePreviewExpanded, setLivePreviewExpanded] = useState(false);
  const livePreviewTimeout = useRef<number | null>(null);

  // Request ID for race condition prevention
  const previewRequestId = useRef(0);

  const isOpen = mode !== "empty" && Boolean(folderId);
  const isNew = mode === "new";

  const handleSave = useCallback(async () => {
    const validationError = validateRule(draft);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaveError(null);
    if (draft.id) {
      await updateRule(draft);
    } else {
      await createRule({ ...draft, folderId });
      onClose();
      return;
    }

    const { error } = useRuleStore.getState();
    if (error) {
      setSaveError(error);
      return;
    }
  }, [draft, updateRule, createRule, folderId, onClose]);

  const handlePreview = useCallback(async () => {
    // Increment request ID to invalidate any pending requests
    const currentRequestId = ++previewRequestId.current;

    setShowPreview(true);
    setLoadingPreview(true);
    setPreviewError(null);
    setPreviewResults([]);
    try {
      const results = await previewRuleDraft({ ...draft, folderId }, previewMaxFiles);
      // Only update if this is still the latest request
      if (currentRequestId === previewRequestId.current) {
        setPreviewResults(results);
      }
    } catch (error) {
      if (currentRequestId === previewRequestId.current) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setPreviewError(errorMessage);
      }
    } finally {
      if (currentRequestId === previewRequestId.current) {
        setLoadingPreview(false);
      }
    }
  }, [draft, folderId, previewMaxFiles]);

  // Live preview: debounced update when conditions change
  useEffect(() => {
    if (!isOpen || draft.conditions.conditions.length === 0) {
      setLivePreviewResults([]);
      return;
    }

    // Clear existing timeout
    if (livePreviewTimeout.current) {
      window.clearTimeout(livePreviewTimeout.current);
    }

    // Increment request ID to invalidate any pending requests
    const currentRequestId = ++previewRequestId.current;

    // Debounce the preview request
    setLivePreviewLoading(true);
    livePreviewTimeout.current = window.setTimeout(async () => {
      try {
        const results = await previewRuleDraft({ ...draft, folderId }, previewMaxFiles);
        // Only update if this is still the latest request
        if (currentRequestId === previewRequestId.current) {
          setLivePreviewResults(results);
        }
      } catch {
        // Silently fail for live preview - don't show errors
        if (currentRequestId === previewRequestId.current) {
          setLivePreviewResults([]);
        }
      } finally {
        if (currentRequestId === previewRequestId.current) {
          setLivePreviewLoading(false);
        }
      }
    }, 500);

    return () => {
      if (livePreviewTimeout.current) {
        window.clearTimeout(livePreviewTimeout.current);
      }
    };
  }, [draft, folderId, isOpen, previewMaxFiles]);



  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (matchesShortcut(event, { key: "s", ctrlOrMeta: true, allowInInput: true })) {
        event.preventDefault();
        void handleSave();
      }
      if (
        draft.id &&
        matchesShortcut(event, { key: ["delete", "backspace"], allowInInput: false })
      ) {
        event.preventDefault();
        void deleteRule(draft.id, folderId);
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, draft, folderId, deleteRule, onClose, handleSave]);

  if (!isOpen) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-sm text-[var(--fg-muted)]">
        <div>Select a rule to view or edit.</div>
        {onNewRule && folderId ? (
          <button
            onClick={onNewRule}
            className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-4 py-2 font-semibold text-[var(--fg-primary)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--bg-subtle)]"
          >
            <Plus className="h-4 w-4" />
            Create new rule
          </button>
        ) : null}
      </div>
    );
  }

  const inputClass = isMagi
    ? "w-full bg-black border border-[var(--border-main)] px-3 py-2 text-base text-[var(--fg-primary)] font-bold shadow-none outline-none focus:bg-[var(--fg-primary)] focus:text-black transition-colors rounded-none placeholder:text-[var(--border-dim)]"
    : "w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2 text-base text-[var(--fg-primary)] shadow-none outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]";

  return (
    <div className="flex h-full flex-col text-[var(--fg-primary)] relative">
      {isMagi ? (
        <div className="absolute inset-0 hex-bg opacity-10 pointer-events-none" />
      ) : null}

      {/* Hazel-style header with rule name as title */}
      <div className={`flex items-center justify-between px-4 py-2.5 shrink-0 border-b relative z-10 bg-[var(--bg-subtle)]/50 ${isMagi ? "border-[var(--border-dim)]" : "border-[var(--border-main)]"
        }`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className={`text-[11px] font-medium uppercase tracking-wider shrink-0 ${isMagi ? "text-[var(--fg-primary)]" : "text-[var(--fg-muted)]"}`}>
            {isNew ? "New Rule" : "Edit Rule"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePreview}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${showPreview
              ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
              : "text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)]"
              }`}
          >
            Preview
          </button>
          <div className="h-4 w-px bg-[var(--border-main)]" />
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium text-[var(--fg-secondary)] rounded transition-colors hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs font-semibold rounded bg-[var(--accent)] text-[var(--accent-contrast)] transition-colors hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar relative z-10">
        {/* Rule Name - Hazel style prominent input */}
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <label className={`text-sm font-medium shrink-0 ${isMagi ? "text-[var(--fg-primary)] uppercase tracking-wider" : "text-[var(--fg-secondary)]"}`}>
              {isMagi ? "Designation:" : "Name:"}
            </label>
            <input
              className={`${inputClass} font-medium flex-1`}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={isMagi ? "Enter protocol designation" : "e.g. Sort Images by Date"}
            />
          </div>
          <div className="mt-3 flex items-center gap-5">
            <TogglePill
              label={isMagi ? "ENABLED" : "Enabled"}
              checked={draft.enabled}
              onChange={(checked) => setDraft({ ...draft, enabled: checked })}
              tooltip="When enabled, this rule will actively process files that match its conditions. Disable to temporarily pause this rule without deleting it."
            />
            <TogglePill
              label={isMagi ? "HALT ON MATCH" : "Stop processing"}
              checked={draft.stopProcessing}
              onChange={(checked) => setDraft({ ...draft, stopProcessing: checked })}
              tooltip="When enabled, files matching this rule won't be checked against any rules below it. Disable to allow multiple rules to process the same file."
            />
          </div>
        </div>

        {/* Conditions Section */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${isMagi ? "eva-title text-[var(--fg-primary)]" : "text-[var(--fg-muted)]"}`}>
              Conditions
            </h3>
            <HelpTooltip content="Conditions determine which files this rule applies to. Use 'all' to require every condition, 'any' for at least one, or 'none' to exclude files." />
          </div>
          <ConditionBuilder group={draft.conditions} onChange={(conditions) => setDraft({ ...draft, conditions })} />

          {/* Live Preview - Shows match count and expandable list */}
          {draft.conditions.conditions.length > 0 && (
            <div className="mt-3 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] overflow-hidden">
              <button
                onClick={() => setLivePreviewExpanded(!livePreviewExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[var(--bg-panel)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  {livePreviewLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-[var(--fg-muted)]" />
                  ) : livePreviewExpanded ? (
                    <ChevronDown className="h-3 w-3 text-[var(--fg-muted)]" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-[var(--fg-muted)]" />
                  )}
                  <span className="text-[var(--fg-secondary)]">Live Preview</span>
                </div>
                <div className="flex items-center gap-2">
                  {livePreviewLoading ? (
                    <span className="text-[var(--fg-muted)]">Scanning...</span>
                  ) : livePreviewResults.length > 0 ? (
                    <>
                      <span className="text-[var(--accent)] font-medium">
                        {livePreviewResults.filter((r) => r.matched).length} matches
                      </span>
                      <span className="text-[var(--fg-muted)]">
                        / {livePreviewResults.length} files
                      </span>
                    </>
                  ) : (
                    <span className="text-[var(--fg-muted)]">No files in folder</span>
                  )}
                </div>
              </button>

              {livePreviewExpanded && livePreviewResults.length > 0 && (
                <div className="border-t border-[var(--border-main)] max-h-48 overflow-y-auto custom-scrollbar">
                  {livePreviewResults.slice(0, 20).map((item) => (
                    <div
                      key={item.filePath}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs border-b border-[var(--border-main)] last:border-b-0 ${
                        item.matched ? "bg-[var(--accent-muted)]/30" : ""
                      }`}
                    >
                      <span className={item.matched ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"}>
                        {item.matched ? "✓" : "✗"}
                      </span>
                      <span className={`truncate ${item.matched ? "text-[var(--fg-primary)]" : "text-[var(--fg-muted)]"}`}>
                        {item.filePath.split(/[/\\]/).pop()}
                      </span>
                    </div>
                  ))}
                  {livePreviewResults.length > 20 && (
                    <div className="px-3 py-2 text-xs text-[var(--fg-muted)] text-center bg-[var(--bg-panel)]">
                      +{livePreviewResults.length - 20} more files...
                      <button
                        onClick={handlePreview}
                        className="ml-2 text-[var(--accent)] hover:underline"
                      >
                        View all
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions Section */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--fg-secondary)]" />
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${isMagi ? "eva-title text-[var(--fg-secondary)]" : "text-[var(--fg-muted)]"}`}>
              Actions
            </h3>
            <HelpTooltip content="Actions define what happens to files that match the conditions above. Actions run in order from top to bottom." />
          </div>
          <ActionBuilder actions={draft.actions} onChange={(actions) => setDraft({ ...draft, actions })} />
        </div>
      </div>

      {/* Error Message */}
      {saveError ? (
        <div className="mx-4 mb-4 rounded-[var(--radius)] border border-[var(--fg-alert)] bg-[var(--fg-alert)]/10 p-2 text-[var(--fg-alert)] text-xs font-semibold">
          {saveError}
        </div>
      ) : null}

      <PreviewPanel
        open={showPreview}
        onClose={() => setShowPreview(false)}
        results={previewResults}
        loading={loadingPreview}
        error={previewError}
        ruleName={draft.name}
      />
    </div>
  );
}

function validateRule(rule: Rule): string | null {
  return validateConditionGroup(rule.conditions);
}

function validateConditionGroup(group: ConditionGroup): string | null {
  for (const condition of group.conditions) {
    const error = validateCondition(condition);
    if (error) return error;
  }
  return null;
}

function validateCondition(condition: Condition): string | null {
  switch (condition.type) {
    case "name":
    case "extension":
    case "fullName":
      if (!condition.value.trim()) return "Provide a value for the condition.";
      return null;
    case "size":
      if (!condition.value) return "Provide a size threshold.";
      return null;
    case "shellScript":
      if (!condition.command.trim()) return "Provide a shell script command.";
      return null;
    case "nested":
      return validateConditionGroup({
        matchType: condition.matchType,
        conditions: condition.conditions,
      });
    default:
      return null;
  }
}

interface TogglePillProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tooltip?: string;
}

function TogglePill({ label, checked, onChange, tooltip }: TogglePillProps) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          className={`relative h-4 w-7 rounded-full transition-colors ${checked ? "bg-[var(--accent)]" : "bg-[var(--border-main)]"
            }`}
          onClick={() => onChange(!checked)}
        >
          <div
            className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-3" : "translate-x-0"
              }`}
          />
        </div>
        <span className={`text-xs ${checked ? "text-[var(--fg-primary)]" : "text-[var(--fg-muted)]"}`}>
          {label}
        </span>
      </label>
      {tooltip && <HelpTooltip content={tooltip} />}
    </div>
  );
}
