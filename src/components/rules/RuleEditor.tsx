import { useCallback, useEffect, useState } from "react";

import type { Condition, ConditionGroup, Rule } from "@/types";
import { useRuleStore } from "@/stores/ruleStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { ActionBuilder } from "@/components/rules/ActionBuilder";
import { ConditionBuilder } from "@/components/rules/ConditionBuilder";



import { matchesShortcut } from "@/lib/shortcuts";

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
  const theme = useSettingsStore((state) => state.settings.theme);
  const isMagi = theme === "magi";

  const [draft, setDraft] = useState<Rule>(() => rule ?? createEmptyRule(folderId));
  const [showPreview, setShowPreview] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      <div className="flex h-full flex-1 items-center justify-center text-sm text-[var(--fg-muted)]">
        Select a rule to view or edit.
      </div>
    );
  }

  const inputClass = isMagi
    ? "mt-2 w-full bg-black border border-[var(--border-main)] px-3 py-2 text-sm text-[var(--fg-primary)] font-bold shadow-none outline-none focus:bg-[var(--fg-primary)] focus:text-black transition-colors rounded-none placeholder:text-[var(--border-dim)]"
    : "mt-2 w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--fg-primary)] shadow-none outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]";

  return (
    <div className="flex h-full flex-col text-[var(--fg-primary)] relative">
      {isMagi ? (
        <div className="absolute inset-0 hex-bg opacity-10 pointer-events-none" />
      ) : null}

      <div className={`flex items-center justify-between px-4 py-3 shrink-0 border-b relative z-10 ${
        isMagi ? "border-[var(--border-dim)]" : "border-[var(--border-main)]"
      }`}>
        <div>
          <h2 className={`text-lg font-semibold ${isMagi ? "text-3xl uppercase eva-title" : ""}`}>
            {isNew ? (isMagi ? "New Protocol" : "New Rule") : isMagi ? "Edit Protocol" : "Edit Rule"}
          </h2>
          <p className={`text-xs text-[var(--fg-secondary)] ${isMagi ? "uppercase tracking-widest" : ""} mt-0.5`}>
            {isMagi ? "Awaiting directive..." : "Define what should happen when files match."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`px-3 py-1 text-xs font-semibold border rounded-[var(--radius)] transition-colors ${
              showPreview
                ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]"
                : "bg-[var(--bg-panel)] text-[var(--fg-primary)] border-[var(--border-main)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            {showPreview ? "Hide preview" : "Show preview"}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-semibold rounded-[var(--radius)] border border-[var(--border-main)] text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs font-semibold rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] transition-colors hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative z-10">
         {/* Rule Name Section */}
         <div className={`mb-6 p-4 rounded-[var(--radius)] border relative ${
           isMagi ? "border-[var(--border-dim)] bg-black/50" : "border-[var(--border-main)] bg-[var(--bg-subtle)]"
         }`}>
             {isMagi ? (
               <div className="absolute top-0 left-0 bg-[var(--fg-primary)] text-black text-[10px] font-bold px-2 py-0.5">IDENTIFICATION</div>
             ) : null}
             <div className={isMagi ? "mt-3" : ""}>
                 <label className={`text-xs font-semibold ${isMagi ? "uppercase tracking-widest text-[var(--border-dim)]" : "text-[var(--fg-secondary)]"}`}>
                   {isMagi ? "Protocol Name" : "Rule name"}
                 </label>
                 <input
                    className={inputClass}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder={isMagi ? "Enter protocol designation" : "e.g. Sort invoices"}
                 />
             </div>
             
             <div className="mt-4 flex items-center gap-6">
                <TogglePill
                  label={isMagi ? "ENABLED" : "Enabled"}
                  checked={draft.enabled}
                  onChange={(checked) => setDraft({ ...draft, enabled: checked })}
                />
                <TogglePill
                  label={isMagi ? "HALT ON MATCH" : "Stop processing"}
                  checked={draft.stopProcessing}
                  onChange={(checked) => setDraft({ ...draft, stopProcessing: checked })}
                />
             </div>
         </div>

         {/* Conditions Section */}
         <div className="mb-6">
             <div className="flex items-center gap-2 mb-3 border-b border-[var(--border-main)] pb-2">
                 <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                 <h3 className={`text-sm font-semibold ${isMagi ? "uppercase eva-title text-[var(--fg-primary)]" : "text-[var(--fg-primary)]"}`}>
                   Conditions
                 </h3>
             </div>
             <ConditionBuilder group={draft.conditions} onChange={(conditions) => setDraft({ ...draft, conditions })} />
         </div>

         {/* Actions Section */}
         <div className="mb-6">
             <div className="flex items-center gap-2 mb-3 border-b border-[var(--border-main)] pb-2">
                 <div className="h-2 w-2 rounded-full bg-[var(--fg-secondary)]" />
                 <h3 className={`text-sm font-semibold ${isMagi ? "uppercase eva-title text-[var(--fg-secondary)]" : "text-[var(--fg-primary)]"}`}>
                   Actions
                 </h3>
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
    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => onChange(!checked)}>
      <div
        className={`h-4 w-7 rounded-full border border-[var(--border-main)] p-0.5 transition-colors ${
          checked ? "bg-[var(--accent)]" : "bg-[var(--bg-panel)]"
        }`}
      >
        <div
          className={`h-3 w-3 rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] transition-transform ${
            checked ? "translate-x-3" : "translate-x-0"
          }`}
        />
      </div>
      <span className={`text-[11px] font-semibold ${checked ? "text-[var(--fg-primary)]" : "text-[var(--fg-muted)]"}`}>
        {label}
      </span>
    </div>
  );
}
