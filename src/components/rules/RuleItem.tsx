import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import type { Condition, Rule } from "@/types";


interface RuleItemProps {
  rule: Rule;
  selected: boolean;
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
  selected,
  onToggle,
  onEdit,
  onDelete,
}: RuleItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
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
      onClick={onEdit}
      className={`group flex items-start gap-3 rounded-[var(--radius)] border px-3 py-2 text-xs cursor-pointer select-none transition-colors mb-1 ${
        selected
          ? "bg-[var(--accent-muted)] text-[var(--fg-primary)] border-[var(--accent)]"
          : "text-[var(--fg-primary)] border-transparent hover:border-[var(--border-main)] hover:bg-[var(--bg-subtle)]"
      } ${!rule.enabled ? "opacity-50 grayscale" : ""}`}
    >
      <div
        onClick={(e) => {
            e.stopPropagation();
            onToggle(!rule.enabled);
        }}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border-strong)] transition-colors ${
            rule.enabled ? "bg-[var(--accent)] border-[var(--accent)]" : "bg-[var(--bg-panel)]"
        }`}
      >
          {rule.enabled && <div className="h-1.5 w-1.5 rounded-sm bg-[var(--accent-contrast)]" />}
      </div>

      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        <span className="truncate text-sm font-semibold">{rule.name}</span>
        <span className="truncate text-[10px] leading-tight text-[var(--fg-muted)]">
          {triggerSummary} &gt;&gt; {actionSummary}
        </span>
      </div>

      {selected && (
         <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded-[var(--radius)] px-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--fg-alert)] hover:text-[var(--fg-inverse)]"
            >
                <Trash2 className="h-3 w-3" />
            </button>
         </div>
      )}
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
