import { useCallback, useEffect, useMemo, useState } from "react";
// import { Plus, Terminal } from "lucide-react";

import { useFolderStore } from "@/stores/folderStore";

// Stable empty function reference to avoid creating new functions on each render
const noop = () => {};
import { useRuleStore } from "@/stores/ruleStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useLogStore } from "@/stores/logStore";
import type { Rule } from "@/types";
import { RuleItem } from "@/components/rules/RuleItem";
import { matchesShortcut } from "@/lib/shortcuts";
// import { PresetImportDialog } from "@/components/presets/PresetImportDialog";

interface RuleListProps {
  selectedRuleId: string;
  onSelectRule: (rule: Rule) => void;
  onNewRule: () => void;
  searchQuery?: string;
  onOpenTemplates?: () => void;
}

export function RuleList({ selectedRuleId, onSelectRule, onNewRule, searchQuery = "", onOpenTemplates }: RuleListProps) {
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const rules = useRuleStore((state) => state.rules);
  const toggleRule = useRuleStore((state) => state.toggleRule);
  const deleteRule = useRuleStore((state) => state.deleteRule);
  const duplicateRule = useRuleStore((state) => state.duplicateRule);
  const reorderRules = useRuleStore((state) => state.reorderRules);
  const ruleStats = useLogStore((state) => state.ruleStats);
  const compactMode = useSettingsStore((state) => state.settings.compactMode);

  // Create a map of rules by ID for efficient lookup
  const rulesById = useMemo(() => new Map(rules.map((r) => [r.id, r])), [rules]);

  const handleCreate = useCallback(() => {
    onNewRule();
  }, [onNewRule]);

  // Stable callbacks for RuleItem
  const handleToggle = useCallback((ruleId: string, enabled: boolean) => {
    if (selectedFolderId) {
      toggleRule(ruleId, enabled, selectedFolderId);
    }
  }, [toggleRule, selectedFolderId]);

  const handleEdit = useCallback((ruleId: string) => {
    const rule = rulesById.get(ruleId);
    if (rule) {
      onSelectRule(rule);
    }
  }, [rulesById, onSelectRule]);

  const handleDelete = useCallback((ruleId: string) => {
    if (selectedFolderId) {
      deleteRule(ruleId, selectedFolderId);
    }
  }, [deleteRule, selectedFolderId]);

  const handleDuplicate = useCallback(async (ruleId: string) => {
    if (!selectedFolderId) return;
    const duplicated = await duplicateRule(ruleId, selectedFolderId);
    if (duplicated) {
      onSelectRule(duplicated);
    }
  }, [duplicateRule, onSelectRule, selectedFolderId]);

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
          <div className="p-4">
            <div className="rounded-[var(--radius)] border border-dashed border-[var(--border-main)] bg-[var(--bg-subtle)] px-4 py-5 text-xs text-[var(--fg-muted)]">
              <div className="text-sm font-semibold text-[var(--fg-primary)]">Create your first rule</div>
              <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                Define when a file should match and what to do next.
              </p>
              <ol className="mt-3 list-decimal list-inside space-y-1 text-[11px]">
                <li>Create a rule for this folder</li>
                <li>Add conditions and actions</li>
                <li>Preview and enable</li>
              </ol>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="rounded-[var(--radius)] bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-[var(--accent-contrast)] transition-colors hover:opacity-90"
                >
                  New rule
                </button>
                {onOpenTemplates ? (
                  <button
                    type="button"
                    onClick={onOpenTemplates}
                    className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-1.5 text-[11px] font-semibold text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                  >
                    From template
                  </button>
                ) : null}
                <span className="text-[10px] text-[var(--fg-muted)]">Ctrl/Cmd+N</span>
              </div>
            </div>
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
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              compact={compactMode}
              lastActivityAt={ruleStats[rule.id]?.lastActivityAt}
              recentEvents={ruleStats[rule.id]?.recentEvents ?? 0}
              recentErrors={ruleStats[rule.id]?.recentErrors ?? 0}
              onDragStart={isDraggingEnabled ? handleDragStart : noop}
              onDragOver={isDraggingEnabled ? handleDragOver : noop}
              onDragEnd={isDraggingEnabled ? handleDragEnd : noop}
              isDragging={isDraggingEnabled && dragIndex === index}
              isDragOver={isDraggingEnabled && dragOverIndex === index}
            />
          ))
        )}
      </div>
    </div>
  );
}
