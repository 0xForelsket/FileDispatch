import { useCallback, useEffect, useState } from "react";
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
  searchQuery?: string;
}

export function RuleList({ selectedRuleId, onSelectRule, onNewRule, searchQuery = "" }: RuleListProps) {
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



  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Filter rules based on search query
  const filteredRules = searchQuery.trim()
    ? rules.filter((rule) => {
        const query = searchQuery.toLowerCase();
        // Match against rule name
        if (rule.name.toLowerCase().includes(query)) return true;
        // Match against action types
        if (rule.actions.some((action) => action.type.toLowerCase().includes(query))) return true;
        // Match against condition values
        if (rule.conditions.conditions.some((condition) => {
          if ("value" in condition && typeof condition.value === "string") {
            return condition.value.toLowerCase().includes(query);
          }
          return condition.type.toLowerCase().includes(query);
        })) return true;
        return false;
      })
    : rules;

  if (!selectedFolderId) {
    return null;
  }

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (index: number) => {
    if (dragIndex === null || index === dragIndex) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const reordered = [...rules];
      const [item] = reordered.splice(dragIndex, 1);
      reordered.splice(dragOverIndex, 0, item);
      void reorderRules(
        selectedFolderId,
        reordered.map((rule) => rule.id),
      );
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Disable drag-and-drop when filtering to avoid index confusion
  const isDraggingEnabled = !searchQuery.trim();

  return (
    <div className="h-full flex flex-col">
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {rules.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-[var(--fg-muted)]">
            No rules yet. Create one to start organizing files.
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-[var(--fg-muted)]">
            No rules match &quot;{searchQuery}&quot;
          </div>
        ) : (
          filteredRules.map((rule, index) => (
            <RuleItem
              key={rule.id}
              rule={rule}
              index={index}
              selected={rule.id === selectedRuleId}
              onToggle={(enabled) => toggleRule(rule.id, enabled, selectedFolderId)}
              onEdit={() => onSelectRule(rule)}
              onDelete={() => deleteRule(rule.id, selectedFolderId)}
              onDuplicate={() => duplicateRule(rule.id, selectedFolderId)}
              onDragStart={isDraggingEnabled ? handleDragStart : () => {}}
              onDragOver={isDraggingEnabled ? handleDragOver : () => {}}
              onDragEnd={isDraggingEnabled ? handleDragEnd : () => {}}
              isDragging={isDraggingEnabled && dragIndex === index}
              isDragOver={isDraggingEnabled && dragOverIndex === index}
            />
          ))
        )}
      </div>
    </div>
  );
}
