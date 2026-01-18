import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import { useFolderStore } from "@/stores/folderStore";
import { useRuleStore } from "@/stores/ruleStore";
import type { Rule } from "@/types";
import { RuleItem } from "@/components/rules/RuleItem";
import { RuleEditor } from "@/components/rules/RuleEditor";

export function RuleList() {
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const folders = useFolderStore((state) => state.folders);
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
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        <Sparkles className="h-6 w-6" />
        <div>
          <div className="font-medium text-foreground">No folder selected</div>
          <div className="text-xs text-muted-foreground">
            Select a folder to view its rules.
          </div>
        </div>
      </div>
    );
  }

  const folderName = folders.find((folder) => folder.id === selectedFolderId)?.name;

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
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Sparkles className="h-6 w-6" />
            <div>
              <div className="font-medium text-foreground">
                No rules for {folderName ?? "this folder"}
              </div>
              <div className="text-xs text-muted-foreground">
                Create rules to automatically organize files in this folder.
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Try a template: Sort by file type • Clean up old files
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              onClick={handleCreate}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Create Rule
            </button>
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
