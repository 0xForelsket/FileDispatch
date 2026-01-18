import { useEffect, useRef, useState } from "react";
import { Edit3, MoreVertical, Trash2, Zap } from "lucide-react";

import type { Condition, Rule } from "@/types";
import { formatShortcut } from "@/lib/shortcuts";

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
  onDuplicate,
}: RuleItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerSummary = summarizeConditions(rule.conditions.conditions);
  const actionSummary = summarizeAction(rule.actions[0]);
  const deleteShortcut = formatShortcut({ key: "Del" });

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
      className={`group flex items-center gap-3 border-b border-[#1f1f24] px-3 py-2 text-[12px] ${
        selected ? "bg-[#191a1e]" : "hover:bg-[#141519]"
      } ${!rule.enabled ? "opacity-60" : ""}`}
    >
      <button
        onClick={() => onToggle(!rule.enabled)}
        className={`relative h-4 w-7 rounded-full transition-colors ${
          rule.enabled ? "bg-[#c07a46]" : "bg-[#2a2b31]"
        }`}
        type="button"
        title={rule.enabled ? "Disable rule" : "Enable rule"}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-[#0c0d0f] transition-all ${
            rule.enabled ? "left-3.5" : "left-0.5"
          }`}
        />
      </button>

      <button className="flex min-w-0 flex-1 items-start gap-2 text-left" onClick={onEdit} type="button">
        <Zap className="mt-0.5 h-3.5 w-3.5 text-[#c07a46]" />
        <div className="min-w-0">
          <div className="truncate font-medium text-[#e7e1d8]">{rule.name}</div>
          <div className="truncate font-mono text-[10px] text-[#8f8a82]">
            {triggerSummary} → {actionSummary}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1 text-[#7c776f]">
        <button
          className="rounded-md p-1 transition-colors hover:bg-[#1f2025] hover:text-[#e7e1d8]"
          onClick={onEdit}
          type="button"
        >
          <Edit3 className="h-3.5 w-3.5" />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            className="rounded-md p-1 transition-colors hover:bg-[#1f2025] hover:text-[#e7e1d8]"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-36 rounded-md border border-[#2a2b31] bg-[#141518] p-1 text-[11px] shadow-lg">
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-[#cfc9bf] hover:bg-[#1f2025]"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate();
                }}
                type="button"
              >
                Duplicate
              </button>
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-[#d28b7c] hover:bg-[#2a1916]"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                type="button"
              >
                <Trash2 className="h-3 w-3" />
                Delete
                <kbd className="ml-auto rounded border border-[#2a2b31] px-1 text-[9px] text-[#8c8780]">
                  {deleteShortcut}
                </kbd>
              </button>
            </div>
          ) : null}
        </div>
      </div>
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
