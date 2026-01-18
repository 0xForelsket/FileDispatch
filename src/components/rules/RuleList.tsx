import { useCallback, useEffect } from "react";
import { Plus, Terminal } from "lucide-react";

import { useFolderStore } from "@/stores/folderStore";
import { useRuleStore } from "@/stores/ruleStore";
import type { Rule } from "@/types";
import { RuleItem } from "@/components/rules/RuleItem";
import { formatShortcut, matchesShortcut } from "@/lib/shortcuts";
import { PresetImportDialog } from "@/components/presets/PresetImportDialog";

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

  const newRuleShortcut = formatShortcut({ key: "N", ctrlOrMeta: true });

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
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[#1f1f24] px-3 py-3">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c07a46]">
          <Terminal className="h-3.5 w-3.5" />
          Rules
        </h3>
        <div className="flex items-center gap-2">
          <PresetImportDialog folderId={selectedFolderId} />
          <button
            className="inline-flex items-center gap-1 rounded-md border border-[#2a2b31] bg-[#15171a] px-2 py-1 text-[11px] font-semibold text-[#cfc9bf] transition-colors hover:border-[#3a3b42]"
            onClick={handleCreate}
            type="button"
          >
            <Plus className="h-3.5 w-3.5 text-[#c07a46]" />
            New
            <kbd className="ml-1 rounded border border-[#2a2b31] px-1 text-[9px] text-[#807a72]">
              {newRuleShortcut}
            </kbd>
          </button>
        </div>
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {rules.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-[#8c8780]">
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
    </section>
  );
}
