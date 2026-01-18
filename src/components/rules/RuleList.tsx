import { useState } from "react";
import { Plus } from "lucide-react";

import { useFolderStore } from "@/stores/folderStore";
import { useRuleStore } from "@/stores/ruleStore";
import type { Rule } from "@/types";
import { RuleItem } from "@/components/rules/RuleItem";
import { RuleEditor } from "@/components/rules/RuleEditor";

export function RuleList() {
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const rules = useRuleStore((state) => state.rules);
  const toggleRule = useRuleStore((state) => state.toggleRule);
  const deleteRule = useRuleStore((state) => state.deleteRule);
  const duplicateRule = useRuleStore((state) => state.duplicateRule);
  const reorderRules = useRuleStore((state) => state.reorderRules);

  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const handleCreate = () => {
    setEditingRule(null);
    setEditorOpen(true);
  };

  if (!selectedFolderId) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Select a folder to view its rules.
      </div>
    );
  }

  const moveRule = (from: number, to: number) => {
    if (to < 0 || to >= rules.length) return;
    const reordered = [...rules];
    const [item] = reordered.splice(from, 1);
    reordered.splice(to, 0, item);
    void reorderRules(
      selectedFolderId,
      reordered.map((rule) => rule.id),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Rules</h2>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          onClick={handleCreate}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Add Rule
        </button>
      </div>
      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No rules yet. Create one to start organizing files.
          </div>
        ) : (
          rules.map((rule, index) => (
            <RuleItem
              key={rule.id}
              rule={rule}
              onToggle={(enabled) => toggleRule(rule.id, enabled, selectedFolderId)}
              onEdit={() => {
                setEditingRule(rule);
                setEditorOpen(true);
              }}
              onDelete={() => deleteRule(rule.id, selectedFolderId)}
              onDuplicate={() => duplicateRule(rule.id, selectedFolderId)}
              onMoveUp={() => moveRule(index, index - 1)}
              onMoveDown={() => moveRule(index, index + 1)}
              canMoveUp={index > 0}
              canMoveDown={index < rules.length - 1}
            />
          ))
        )}
      </div>
      <RuleEditor
        key={`${editingRule?.id ?? "new"}-${editorOpen ? "open" : "closed"}`}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        folderId={selectedFolderId}
        rule={editingRule}
      />
    </div>
  );
}
