import { memo, useState } from "react";
import { Copy, GripVertical, Trash2 } from "lucide-react";

import type { Condition, Rule } from "@/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";


interface RuleItemProps {
  rule: Rule;
  selected: boolean;
  index: number;
  onToggle: (ruleId: string, enabled: boolean) => void;
  onEdit: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onDuplicate: (ruleId: string) => void;
  compact?: boolean;
  lastActivityAt?: string;
  recentEvents?: number;
  recentErrors?: number;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDragOver: boolean;
}

export const RuleItem = memo(function RuleItem({
  rule,
  selected,
  index,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
  compact = false,
  lastActivityAt,
  recentEvents = 0,
  recentErrors = 0,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isDragOver,
}: RuleItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const triggerSummary = summarizeConditions(rule.conditions.conditions);
  const actionSummary = summarizeAction(rule.actions[0]);
  const activityParts: string[] = [];
  if (lastActivityAt) {
    activityParts.push(`Last run ${formatTimestamp(lastActivityAt)}`);
  }
  if (recentEvents > 0) {
    activityParts.push(`${recentEvents} events (24h)`);
  }
  if (recentErrors > 0) {
    activityParts.push(`${recentErrors} errors`);
  }

  const rowSpacing = compact ? "px-2 py-1.5" : "px-2 py-2";
  const titleClass = compact ? "text-[12px]" : "text-[13px]";
  const metaClass = compact ? "text-[10px]" : "text-[11px]";

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
      className={`content-visibility-auto group flex items-start gap-2 rounded-[var(--radius)] ${rowSpacing} text-xs cursor-pointer select-none transition duration-150 ease-out ${
        selected
          ? "bg-[var(--accent-muted)] text-[var(--fg-primary)] shadow-sm"
          : "text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]"
      } ${!rule.enabled ? "opacity-50" : ""} ${isDragging ? "opacity-40 scale-[0.98] motion-reduce:transform-none" : ""} ${isDragOver ? "border-t-2 border-[var(--accent)]" : ""}`}
    >
      <div
        className="mt-0.5 cursor-grab active:cursor-grabbing text-[var(--fg-muted)] opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      {/* Things-style circular checkbox */}
      <button
        type="button"
        onClick={(e) => {
            e.stopPropagation();
            onToggle(rule.id, !rule.enabled);
        }}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition duration-200 ease-out ${
            rule.enabled
              ? "bg-[var(--accent)] border-[var(--accent)] shadow-sm"
              : "bg-transparent border-[var(--border-strong)] hover:border-[var(--fg-muted)]"
        }`}
        aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
      >
          {rule.enabled && (
            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
      </button>

      <button
        type="button"
        onClick={() => onEdit(rule.id)}
        className="min-w-0 flex-1 flex flex-col gap-0.5 overflow-hidden text-left"
        aria-label={`Edit rule ${rule.name}`}
      >
        <span className={`truncate ${titleClass} font-medium leading-tight`}>{rule.name}</span>
        <span className={`truncate ${metaClass} leading-tight text-[var(--fg-muted)]`}>
          {triggerSummary} → {actionSummary}
        </span>
        {activityParts.length > 0 ? (
          <span className={`truncate ${metaClass} text-[var(--fg-muted)]`}>
            {activityParts.join(" · ")}
          </span>
        ) : null}
      </button>

      {selected && (
         <div className="flex items-center">
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(rule.id); }}
              className="rounded-[var(--radius)] p-1 text-[var(--fg-muted)] transition-colors duration-150 hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
              aria-label="Duplicate rule"
              type="button"
            >
                <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
              className="rounded-[var(--radius)] p-1 text-[var(--fg-muted)] transition-colors duration-150 hover:bg-[var(--fg-alert)]/15 hover:text-[var(--fg-alert)]"
              aria-label="Delete rule"
              type="button"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
         </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => onDelete(rule.id)}
        title="Delete Rule"
        message={`Are you sure you want to delete "${rule.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
});

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
    case "contents":
      return `contents ${first.operator} ${first.value || "…"}`;
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
    case "makePdfSearchable":
      return "ocr pdf";
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

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
