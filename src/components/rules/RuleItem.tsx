import { Copy, Pencil, Trash2 } from "lucide-react";

import type { Rule } from "@/types";

interface RuleItemProps {
  rule: Rule;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function RuleItem({
  rule,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: RuleItemProps) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="h-4 w-4"
            />
            <h3 className="font-medium">{rule.name}</h3>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Conditions: {rule.conditions.conditions.length} • Actions: {rule.actions.length}
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <button
            className="rounded-md border border-border px-2 text-xs disabled:opacity-40"
            onClick={onMoveUp}
            type="button"
            disabled={!canMoveUp}
            title="Move up"
          >
            ↑
          </button>
          <button
            className="rounded-md border border-border px-2 text-xs disabled:opacity-40"
            onClick={onMoveDown}
            type="button"
            disabled={!canMoveDown}
            title="Move down"
          >
            ↓
          </button>
          <button
            className="rounded-md border border-border p-1.5 hover:text-foreground"
            onClick={onEdit}
            type="button"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            className="rounded-md border border-border p-1.5 hover:text-foreground"
            onClick={onDuplicate}
            type="button"
            title="Duplicate"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            className="rounded-md border border-destructive/40 p-1.5 text-destructive hover:text-destructive"
            onClick={onDelete}
            type="button"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
