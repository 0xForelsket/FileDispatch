import { useState } from "react";
import { Plus, Terminal } from "lucide-react";

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
    return null;
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
    <section>
      <div className="mb-6 flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-900 drop-shadow-sm dark:text-neutral-200">
          <Terminal className="h-4 w-4 text-blue-600 dark:text-cyan-500" />
          Logic Gates
        </h3>
        <button
          className="group flex items-center gap-2 rounded-xl border border-blue-200/50 bg-white/60 py-2 px-4 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur-md transition-all hover:scale-[1.03] hover:bg-white hover:shadow-md dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/20"
          onClick={handleCreate}
          type="button"
        >
          <Plus className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
          New Logic Gate
        </button>
      </div>
      <div className="grid gap-4">
        {rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200/60 p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-neutral-500">
            No logic gates yet. Create one to start organizing files.
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
    </section>
  );
}
