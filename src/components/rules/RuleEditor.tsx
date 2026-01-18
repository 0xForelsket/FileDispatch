import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";

import type { Condition, ConditionGroup, Rule } from "@/types";
import { useRuleStore } from "@/stores/ruleStore";
import { ActionBuilder } from "@/components/rules/ActionBuilder";
import { ConditionBuilder } from "@/components/rules/ConditionBuilder";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { previewRule } from "@/lib/tauri";
import type { PreviewItem } from "@/types";
import { formatShortcut, matchesShortcut } from "@/lib/shortcuts";

interface RuleEditorProps {
  mode: "empty" | "new" | "edit";
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

export function RuleEditor({ mode, onClose, folderId, rule }: RuleEditorProps) {
  const createRule = useRuleStore((state) => state.createRule);
  const updateRule = useRuleStore((state) => state.updateRule);
  const deleteRule = useRuleStore((state) => state.deleteRule);

  const [draft, setDraft] = useState<Rule>(() => rule ?? createEmptyRule(folderId));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState<PreviewItem[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveShortcut = useMemo(() => formatShortcut({ key: "S", ctrlOrMeta: true }), []);

  const isOpen = mode !== "empty" && Boolean(folderId);
  const isNew = mode === "new";

  useEffect(() => {
    if (!isOpen) return;
    if (rule) {
      setDraft(rule);
    } else {
      setDraft(createEmptyRule(folderId));
    }
    setSaveError(null);
  }, [isOpen, rule, folderId]);

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
      <div className="flex h-full flex-1 items-center justify-center text-sm text-[#7f7a73]">
        Select a rule to view or edit.
      </div>
    );
  }

  const inputClass =
    "mt-2 w-full rounded-md border border-[#2a2b31] bg-[#141518] px-3 py-2 text-sm text-[#e7e1d8] shadow-none outline-none transition focus:border-[#c07a46] focus:ring-1 focus:ring-[#c07a46]/30";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[#1f1f24] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#e7e1d8]">
            {isNew ? "New Rule" : "Edit Rule"}
          </h2>
          <p className="text-[11px] text-[#7f7a73]">
            Define conditions and actions for this folder.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-[#2a2b31] px-2 py-1 text-[11px] text-[#cfc9bf] transition-colors hover:border-[#3a3b42]"
            onClick={handlePreview}
            type="button"
            disabled={!draft.id}
          >
            <Eye className="mr-1 inline h-3 w-3" />
            Preview
          </button>
          <button
            className="rounded-md border border-transparent px-2 py-1 text-[11px] text-[#8c8780] transition-colors hover:text-[#e7e1d8]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
          <button
            className="rounded-md border border-[#c07a46] bg-[#c07a46] px-3 py-1 text-[11px] font-semibold text-[#0d0e10] transition-colors hover:bg-[#d38a52]"
            onClick={handleSave}
            type="button"
          >
            Save
            <kbd className="ml-2 rounded border border-[#d9a074] px-1 text-[9px] text-[#24160e]">
              {saveShortcut}
            </kbd>
          </button>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7f7a73]">
              Rule Name
            </label>
            <input
              className={inputClass}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <TogglePill
              label="Enabled"
              checked={draft.enabled}
              onChange={(checked) => setDraft({ ...draft, enabled: checked })}
            />
            <TogglePill
              label="Stop after match"
              checked={draft.stopProcessing}
              onChange={(checked) => setDraft({ ...draft, stopProcessing: checked })}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7f7a73]">
              Conditions
            </h3>
            <ConditionBuilder
              group={draft.conditions}
              onChange={(conditions) => setDraft({ ...draft, conditions })}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7f7a73]">
              Actions
            </h3>
            <ActionBuilder
              actions={draft.actions}
              onChange={(actions) => setDraft({ ...draft, actions })}
            />
            <p className="text-[10px] text-[#7f7a73]">
              Variables: {"{name} {ext} {fullname} {created} {modified} {added} {now}"} {"{year} {month} {day} {size} {parent} {counter} {random}"}
            </p>
          </div>

          {saveError ? <div className="text-[11px] text-[#d28b7c]">{saveError}</div> : null}
        </div>
      </div>

      <PreviewPanel
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        results={previewResults}
        loading={previewLoading}
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
}

function TogglePill({ label, checked, onChange }: TogglePillProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
        checked
          ? "border-[#c07a46] bg-[#c07a46] text-[#0d0e10]"
          : "border-[#2a2b31] bg-[#141518] text-[#9c958c]"
      }`}
    >
      {label}
    </button>
  );
}
