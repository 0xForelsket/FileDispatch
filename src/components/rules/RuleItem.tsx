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
      className={`group flex items-center gap-2 px-2 py-1 font-mono text-xs cursor-pointer select-none border-l-2 ${
        selected
          ? "bg-[var(--selection-bg)] text-black border-[var(--selection-bg)]"
          : "text-[var(--fg-primary)] border-transparent hover:bg-[var(--fg-primary)] hover:text-black hover:border-[var(--fg-primary)]"
      } ${!rule.enabled ? "opacity-50 grayscale" : ""}`}
    >
      {/* Checkbox (Hex Style) */}
      <div 
        onClick={(e) => {
            e.stopPropagation();
            onToggle(!rule.enabled);
        }}
        className={`w-3 h-3 shrink-0 border border-current flex items-center justify-center cursor-pointer ${
            rule.enabled ? "bg-current" : ""
        }`}
      >
          {rule.enabled && <div className="w-1.5 h-1.5 bg-black" />}
      </div>

      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        <span className="truncate font-bold tracking-wider">{rule.name.toUpperCase()}</span>
        <span className="truncate text-[9px] opacity-80 leading-tight">
          {triggerSummary} &gt;&gt; {actionSummary}
        </span>
      </div>

      {selected && (
         <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-black hover:text-white hover:bg-black rounded-sm px-1"
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
