import { useEffect, useRef, useState } from "react";
import { ArrowRight, Edit3, MoreVertical, Trash2, Zap } from "lucide-react";

import type { Condition, Rule } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";

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
    <GlassCard
      hoverEffect
      className={`relative flex items-center gap-5 p-4 ${!rule.enabled ? "opacity-70 grayscale" : ""}`}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1 ${
          rule.enabled ? "bg-blue-500 dark:bg-cyan-500" : "bg-slate-300 dark:bg-neutral-800"
        }`}
      />
      <div
        className={`ml-2 rounded-xl border p-3 shadow-inner transition-colors duration-300 ${
          rule.enabled
            ? "border-blue-100/50 bg-blue-50/50 text-blue-600 dark:border-cyan-500/20 dark:bg-cyan-900/20 dark:text-cyan-400"
            : "border-slate-200/50 bg-slate-100/50 text-slate-400 dark:border-white/5 dark:bg-white/5 dark:text-neutral-600"
        }`}
      >
        <Zap className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-4">
          <h4
            className={`truncate text-sm font-bold ${
              rule.enabled ? "text-slate-800 dark:text-neutral-100" : "text-slate-500 dark:text-neutral-500"
            }`}
          >
            {rule.name}
          </h4>
        </div>
        <div className="lg:col-span-8 flex items-center gap-2 font-mono text-[11px]">
          <div className="flex max-w-[160px] items-center gap-2 truncate rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-slate-600 shadow-sm dark:border-white/10 dark:bg-black/40 dark:text-neutral-300">
            <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-neutral-600">
              IF
            </span>
            {triggerSummary}
          </div>
          <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-300 dark:text-neutral-600" />
          <div className="flex flex-1 items-center gap-2 truncate rounded-lg border border-blue-100/50 bg-blue-50/50 px-3 py-1.5 text-blue-700 shadow-sm dark:border-cyan-500/20 dark:bg-cyan-900/10 dark:text-cyan-300">
            <span className="text-[9px] font-bold uppercase text-blue-400 dark:text-cyan-700">
              THEN
            </span>
            {actionSummary}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 border-l border-black/5 pl-5 dark:border-white/5">
        <button
          onClick={() => onToggle(!rule.enabled)}
          className={`relative h-6 w-11 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-cyan-500 dark:focus:ring-offset-neutral-900 ${
            rule.enabled
              ? "bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)] dark:bg-cyan-600 dark:shadow-[0_0_15px_rgba(8,145,178,0.4)]"
              : "bg-slate-200 dark:bg-white/10"
          }`}
          type="button"
        >
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300 ${
              rule.enabled ? "left-6" : "left-1"
            }`}
          />
        </button>
        <button
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-800 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={onEdit}
          type="button"
        >
          <Edit3 className="h-4 w-4" />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-800 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-36 rounded-xl border border-slate-200/60 bg-white/90 p-1 text-xs shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/60">
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-white/10"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate();
                }}
                type="button"
              >
                Duplicate
              </button>
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                type="button"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </GlassCard>
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
    case "ignore":
      return "ignore";
    default:
      return "action";
  }
}
