import { useEffect, useRef, useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";

import type { Condition, Rule } from "@/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";


interface RuleItemProps {
  rule: Rule;
  selected: boolean;
  index: number;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDragOver: boolean;
}

export function RuleItem({
  rule,
  selected,
  index,
  onToggle,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isDragOver,
}: RuleItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerSummary = summarizeConditions(rule.conditions.conditions);
  const actionSummary = summarizeAction(rule.actions[0]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(index);
      }}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      className={`group flex items-start gap-1 rounded px-1 py-1.5 text-xs cursor-pointer select-none transition-all ${
        selected
          ? "bg-[var(--accent-muted)] text-[var(--fg-primary)]"
          : "text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)]"
      } ${!rule.enabled ? "opacity-50" : ""} ${isDragging ? "opacity-40" : ""} ${isDragOver ? "border-t-2 border-[var(--accent)]" : ""}`}
    >
      <div
        className="mt-0.5 cursor-grab active:cursor-grabbing text-[var(--fg-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <div
        onClick={(e) => {
            e.stopPropagation();
            onToggle(!rule.enabled);
        }}
        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
            rule.enabled ? "bg-[var(--accent)] border-[var(--accent)]" : "bg-[var(--bg-panel)] border-[var(--border-strong)]"
        }`}
      >
          {rule.enabled && <div className="h-1.5 w-1.5 rounded-sm bg-[var(--accent-contrast)]" />}
      </div>

      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        <span className="truncate text-xs font-medium">{rule.name}</span>
        <span className="truncate text-[10px] leading-tight text-[var(--fg-muted)]">
          {triggerSummary} → {actionSummary}
        </span>
      </div>

      {selected && (
         <div className="flex items-center">
            <button
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
              className="rounded p-0.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--fg-alert)]/20 hover:text-[var(--fg-alert)]"
            >
                <Trash2 className="h-3 w-3" />
            </button>
         </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={onDelete}
        title="Delete Rule"
        message={`Are you sure you want to delete "${rule.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function summarizeConditions(conditions: Condition[]) {
  if (conditions.length === 0) return "any file";
  const first = conditions[0];
  switch (first.type) {
    case "name":
      return `name ${first.operator} ${first.value || "…"}`;
    case "extension":
      return `*.${first.value || "…"}`;
    case "fullName":
      return `name ${first.operator} ${first.value || "…"}`;
    case "kind":
      return `${first.negate ? "not " : ""}${first.kind}`;
    case "size":
      return `${first.operator.type} ${first.value ?? "…"} ${first.unit}`;
    case "dateCreated":
    case "dateModified":
    case "dateAdded":
      return `${first.type.replace("date", "").toLowerCase()} ${first.operator.type}`;
    case "currentTime":
      return `time ${first.operator.type}`;
    case "shellScript":
      return "shell script";
    case "nested":
      return `${first.matchType} (${first.conditions.length})`;
    default:
      return "custom";
  }
}

function summarizeAction(action?: Rule["actions"][number]) {
  if (!action) return "no action";
  switch (action.type) {
    case "move":
      return `mv → ${action.destination || "…"}`;
    case "copy":
      return `cp → ${action.destination || "…"}`;
    case "rename":
      return `rename → ${action.pattern || "…"}`;
    case "sortIntoSubfolder":
      return `sort → ${action.destination || "…"}`;
    case "delete":
      return "trash";
    case "deletePermanently":
      return "delete";
    case "runScript":
      return "run script";
    case "notify":
      return "notify";
    case "archive":
      return `archive → ${action.destination || "…"}`;
    case "unarchive":
      return "unarchive";
    case "open":
      return "open";
    case "pause":
      return `pause ${action.durationSeconds}s`;
    case "continue":
      return "continue matching rules";
    case "ignore":
      return "ignore";
    default:
      return "action";
  }
}
