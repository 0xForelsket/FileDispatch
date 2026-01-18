import { useState } from "react";

import type { ConditionGroup, Rule } from "@/types";
import { useRuleStore } from "@/stores/ruleStore";
import { ActionBuilder } from "@/components/rules/ActionBuilder";
import { ConditionBuilder } from "@/components/rules/ConditionBuilder";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { previewRule } from "@/lib/tauri";
import type { PreviewItem } from "@/types";

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

  const [draft, setDraft] = useState<Rule>(() => rule ?? createEmptyRule(folderId));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState<PreviewItem[]>([]);

  if (!open) return null;

  const handleSave = async () => {
    if (draft.id) {
      await updateRule(draft);
    } else {
      await createRule({ ...draft, folderId });
    }
    onClose();
  };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-lg border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{draft.id ? "Edit Rule" : "New Rule"}</h2>
          <button className="text-sm text-muted-foreground" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="mt-4 space-y-6">
          <div>
            <label className="text-xs uppercase text-muted-foreground">Rule Name</label>
            <input
              className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                />
                Enabled
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.stopProcessing}
                  onChange={(e) => setDraft({ ...draft, stopProcessing: e.target.checked })}
                />
                Stop after match
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Conditions</h3>
            <ConditionBuilder
              group={draft.conditions}
              onChange={(conditions) => setDraft({ ...draft, conditions })}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Actions</h3>
            <ActionBuilder
              actions={draft.actions}
              onChange={(actions) => setDraft({ ...draft, actions })}
            />
            <p className="text-xs text-muted-foreground">
              Available variables: {"{name} {ext} {fullname} {created} {modified} {added} {now}"}{" "}
              {"{year} {month} {day} {size} {parent} {counter} {random}"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            className="rounded-md border border-border px-3 py-1.5 text-sm"
            onClick={handlePreview}
            type="button"
            disabled={!draft.id}
            title={draft.id ? "Preview rule" : "Save rule first to preview"}
          >
            Preview
          </button>
          <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-border px-3 py-1.5 text-sm"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            onClick={handleSave}
            type="button"
          >
            Save Rule
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
    </div>
  );
}
