import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, X } from "lucide-react";

import type { Condition, ConditionGroup, Rule } from "@/types";
import { useRuleStore } from "@/stores/ruleStore";
import { ActionBuilder } from "@/components/rules/ActionBuilder";
import { ConditionBuilder } from "@/components/rules/ConditionBuilder";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { previewRule } from "@/lib/tauri";
import type { PreviewItem } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatShortcut, matchesShortcut } from "@/lib/shortcuts";

interface RuleEditorProps {
  open: boolean;
  onClose: () => void;
  folderId: string;
  rule: Rule | null;
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

export function RuleEditor({ open, onClose, folderId, rule }: RuleEditorProps) {
  const createRule = useRuleStore((state) => state.createRule);
  const updateRule = useRuleStore((state) => state.updateRule);
  const deleteRule = useRuleStore((state) => state.deleteRule);

  const [draft, setDraft] = useState<Rule>(() => rule ?? createEmptyRule(folderId));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState<PreviewItem[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveShortcut = useMemo(() => formatShortcut({ key: "S", ctrlOrMeta: true }), []);

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
    }

    const { error } = useRuleStore.getState();
    if (error) {
      setSaveError(error);
      return;
    }

    onClose();
  }, [draft, updateRule, createRule, folderId, onClose]);

  const handlePreview = async () => {
    if (!draft.id) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const results = await previewRule(draft.id);
      setPreviewResults(results);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSaveError(null);
    }
  }, [open, rule]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, draft, folderId, deleteRule, onClose, handleSave]);

  if (!open) return null;

  const modal =
    typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm dark:bg-black/40"
              onClick={onClose}
            />
            <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/20 bg-white/80 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#0f0f0f]/90">
              <div className="flex items-center justify-between border-b border-slate-200/50 p-6 dark:border-white/5">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                    {draft.id ? "Edit Rule" : "New Rule"}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-neutral-500">
                    Define when this rule should run and what it should do.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-white"
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="custom-scrollbar max-h-[70vh] overflow-y-auto p-6">
                <div className="space-y-6">
                  <GlassCard className="space-y-4 p-5">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                        Rule Name
                      </label>
                      <input
                        className="mt-2 w-full rounded-xl border border-white/50 bg-white/70 px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <TogglePill
                        label="Enabled"
                        checked={draft.enabled}
                        onChange={(checked) => setDraft({ ...draft, enabled: checked })}
                      />
                      <TogglePill
                        label="Stop after match"
                        checked={draft.stopProcessing}
                        onChange={(checked) =>
                          setDraft({ ...draft, stopProcessing: checked })
                        }
                      />
                    </div>
                  </GlassCard>

                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">
                      Conditions
                    </h3>
                    <ConditionBuilder
                      group={draft.conditions}
                      onChange={(conditions) => setDraft({ ...draft, conditions })}
                    />
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">
                      Actions
                    </h3>
                    <ActionBuilder
                      actions={draft.actions}
                      onChange={(actions) => setDraft({ ...draft, actions })}
                    />
                    <p className="text-[11px] text-slate-500 dark:text-neutral-500">
                      Variables: {"{name} {ext} {fullname} {created} {modified} {added} {now}"}{" "}
                      {"{year} {month} {day} {size} {parent} {counter} {random}"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/50 bg-slate-50/60 p-4 dark:border-white/5 dark:bg-black/20">
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/60 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                  onClick={handlePreview}
                  type="button"
                  disabled={!draft.id}
                  title={draft.id ? "Preview rule" : "Save rule first to preview"}
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  {saveError ? (
                    <span className="text-xs text-rose-500">{saveError}</span>
                  ) : null}
                  <button
                    className="rounded-xl border border-transparent px-4 py-2 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                    onClick={onClose}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 dark:bg-cyan-600 dark:shadow-cyan-500/20 dark:hover:bg-cyan-500"
                    onClick={handleSave}
                    type="button"
                  >
                    Save Rule
                    <kbd className="rounded-md border border-white/30 bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-white/80">
                      {saveShortcut}
                    </kbd>
                  </button>
                </div>
              </div>
            </div>
            <PreviewPanel
              open={previewOpen}
              onClose={() => setPreviewOpen(false)}
              results={previewResults}
              loading={previewLoading}
              ruleName={draft.name}
            />
          </div>,
          document.body,
        )
      : null;

  return modal;
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
  if (condition.type === "nested") {
    return validateConditionGroup({
      matchType: condition.matchType,
      conditions: condition.conditions,
    });
  }

  if (
    condition.type === "dateCreated" ||
    condition.type === "dateModified" ||
    condition.type === "dateAdded"
  ) {
    const operator = condition.operator;
    if (operator.type === "between") {
      if (!operator.start || !operator.end) {
        return "Date conditions require a start and end date.";
      }
    } else if (operator.type === "is" || operator.type === "isBefore" || operator.type === "isAfter") {
      if (!operator.date) {
        return "Date conditions require a date.";
      }
    }
  }

  if (condition.type === "currentTime") {
    const operator = condition.operator;
    if (operator.type === "between") {
      if (!operator.start || !operator.end) {
        return "Time conditions require a start and end time.";
      }
    } else if (operator.type === "is" || operator.type === "isBefore" || operator.type === "isAfter") {
      if (!operator.time) {
        return "Time conditions require a time value.";
      }
    }
  }

  return null;
}

interface TogglePillProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function TogglePill({ label, checked, onChange }: TogglePillProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
        checked
          ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300"
          : "border-white/40 bg-white/60 text-slate-500 hover:bg-white/80 hover:text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:bg-white/10"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          checked ? "bg-blue-500 dark:bg-cyan-400" : "bg-slate-300 dark:bg-neutral-700"
        }`}
      />
      {label}
    </button>
  );
}
