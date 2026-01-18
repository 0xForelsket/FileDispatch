import { useCallback, useEffect, useState } from "react";

import type { Condition, ConditionGroup, Rule } from "@/types";
import { useRuleStore } from "@/stores/ruleStore";
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

  const [draft, setDraft] = useState<Rule>(() => rule ?? createEmptyRule(folderId));
  const [showPreview, setShowPreview] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      <div className="flex h-full flex-1 items-center justify-center text-sm text-gray-500">
        Select a rule to view or edit.
      </div>
    );
  }

  /* ... inside RuleEditor ... */

  const inputClass =
    "mt-2 w-full bg-black border border-[var(--border-main)] px-3 py-2 text-sm text-[var(--fg-primary)] font-bold font-mono shadow-none outline-none focus:bg-[var(--fg-primary)] focus:text-black transition-colors rounded-none placeholder:text-[var(--border-dim)]";

  return (
    <div className="flex h-full flex-col font-mono text-[var(--fg-primary)] relative">
      {/* Background Decor */}
      <div className="absolute inset-0 hex-bg opacity-10 pointer-events-none" />

      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-[var(--border-dim)] relative z-10">
        <div>
          <h2 className="text-4xl text-[var(--fg-primary)] uppercase eva-title">
            {isNew ? "New Protocol" : "Edit Protocol"}
          </h2>
          <p className="text-xs text-[var(--fg-secondary)] uppercase tracking-widest mt-0.5">
            AWAITING DIRECTIVE...
          </p>
        </div>
        <div className="flex items-center gap-2">
           <button
             onClick={() => setShowPreview(!showPreview)}
             className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border border-[var(--fg-primary)] ${
                 showPreview ? "bg-[var(--fg-primary)] text-black" : "bg-black text-[var(--fg-primary)] hover:bg-[var(--fg-primary)] hover:text-black"
             }`}
           >
             {showPreview ? "HIDE DATA" : "SHOW DATA"}
           </button>
           <button
             onClick={onClose}
             className="px-3 py-1 text-xs font-bold uppercase tracking-wider border border-[var(--fg-alert)] text-[var(--fg-alert)] hover:bg-[var(--fg-alert)] hover:text-black"
           >
             ABORT
           </button>
           <button
             onClick={handleSave}
             className="px-3 py-1 text-xs font-bold uppercase tracking-wider border border-[var(--fg-secondary)] bg-[var(--fg-secondary)] text-black hover:bg-white"
           >
             EXECUTE
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative z-10">
         {/* Rule Name Section */}
         <div className="mb-6 p-4 magi-border-sm bg-black/50 relative">
             <div className="absolute top-0 left-0 bg-[var(--fg-primary)] text-black text-[10px] font-bold px-2 py-0.5">IDENTIFICATION</div>
             <div className="mt-3">
                 <label className="text-xs uppercase text-[var(--border-dim)] tracking-widest font-bold">Protocol Name</label>
                 <input
                    className={inputClass}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="ENTER PROTOCOL DESIGNATION"
                 />
             </div>
             
             <div className="mt-4 flex items-center gap-6">
                <TogglePill
                  label="ENABLED"
                  checked={draft.enabled}
                  onChange={(checked) => setDraft({ ...draft, enabled: checked })}
                />
                <TogglePill
                  label="HALT ON MATCH"
                  checked={draft.stopProcessing}
                  onChange={(checked) => setDraft({ ...draft, stopProcessing: checked })}
                />
             </div>
         </div>

         {/* Conditions Section */}
         <div className="mb-6">
             <div className="flex items-center gap-2 mb-3 p-1 border-b border-[var(--border-dim)]">
                 <div className="w-2 h-2 bg-[var(--fg-primary)]" />
                 <h3 className="text-xl text-[var(--fg-primary)] uppercase eva-title">CONDITIONS</h3>
             </div>
             <ConditionBuilder group={draft.conditions} onChange={(conditions) => setDraft({ ...draft, conditions })} />
         </div>

         {/* Actions Section */}
         <div className="mb-6">
             <div className="flex items-center gap-2 mb-3 p-1 border-b border-[var(--border-dim)]">
                 <div className="w-2 h-2 bg-[var(--fg-secondary)]" />
                 <h3 className="text-xl text-[var(--fg-secondary)] uppercase eva-title">COUNTERMEASURES</h3>
             </div>
             <ActionBuilder actions={draft.actions} onChange={(actions) => setDraft({ ...draft, actions })} />
         </div>
      </div>

      {/* Error Message */}
      {saveError ? (
          <div className="mx-4 mb-4 p-2 border border-[var(--fg-alert)] bg-[var(--fg-alert)]/10 text-[var(--fg-alert)] text-[10px] uppercase font-bold tracking-wider">
              ERROR: {saveError}
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
            className={`w-3 h-3 border border-current flex items-center justify-center transition-colors ${
                checked ? "bg-[var(--fg-secondary)] border-[var(--fg-secondary)]" : "border-[var(--border-dim)] group-hover:border-[var(--fg-primary)]"
            }`}
        >
            {checked && <div className="w-1.5 h-1.5 bg-black" />}
        </div>
        <span className={`text-[11px] font-bold uppercase tracking-wider ${checked ? "text-[var(--fg-secondary)]" : "text-[var(--border-dim)] group-hover:text-[var(--fg-primary)]"}`}>
            {label}
        </span>
    </div>
  );
}
