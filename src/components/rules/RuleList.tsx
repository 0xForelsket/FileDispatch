import { useCallback, useEffect } from "react";
// import { Plus, Terminal } from "lucide-react";

import { useFolderStore } from "@/stores/folderStore";
import { useRuleStore } from "@/stores/ruleStore";
import type { Rule } from "@/types";
import { RuleItem } from "@/components/rules/RuleItem";
import { matchesShortcut } from "@/lib/shortcuts";
// import { PresetImportDialog } from "@/components/presets/PresetImportDialog";

interface RuleListProps {
  selectedRuleId: string;
  onSelectRule: (rule: Rule) => void;
  onNewRule: () => void;
}

export function RuleList({ selectedRuleId, onSelectRule, onNewRule }: RuleListProps) {
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const rules = useRuleStore((state) => state.rules);
  const toggleRule = useRuleStore((state) => state.toggleRule);
  const deleteRule = useRuleStore((state) => state.deleteRule);
  const duplicateRule = useRuleStore((state) => state.duplicateRule);
  const reorderRules = useRuleStore((state) => state.reorderRules);
  const handleCreate = useCallback(() => {
    onNewRule();
  }, [onNewRule]);

  useEffect(() => {
    if (!selectedFolderId) return;
    const handler = (event: KeyboardEvent) => {
      if (matchesShortcut(event, { key: "n", ctrlOrMeta: true })) {
        event.preventDefault();
        handleCreate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedFolderId, handleCreate]);



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
    <div className="h-full flex flex-col">
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {rules.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-[var(--border-dim)]">
            No rules yet. Create one to start organizing files.
          </div>
        ) : (
          rules.map((rule, index) => (
            <RuleItem
              key={rule.id}
              rule={rule}
              selected={rule.id === selectedRuleId}
              onToggle={(enabled) => toggleRule(rule.id, enabled, selectedFolderId)}
              onEdit={() => onSelectRule(rule)}
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
    </div>
  );
}
