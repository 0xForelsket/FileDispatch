import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Copy,
  FolderInput,
  MoreVertical,
  MoveRight,
  PencilLine,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const summary = summarizeFirstAction(rule.actions[0]);

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
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="h-4 w-4"
            />
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="truncate font-medium">{rule.name}</h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {summary ? (
              <span className="inline-flex items-center gap-1">
                {summary.icon}
                {summary.label}
              </span>
            ) : (
              <span>No actions yet</span>
            )}
            <span>•</span>
            <span>
              Conditions: {rule.conditions.conditions.length} • Actions: {rule.actions.length}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <button
            className="rounded-md border border-border p-1 text-xs disabled:opacity-40"
            onClick={onMoveUp}
            type="button"
            disabled={!canMoveUp}
            title="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            className="rounded-md border border-border p-1 text-xs disabled:opacity-40"
            onClick={onMoveDown}
            type="button"
            disabled={!canMoveDown}
            title="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              className="rounded-md border border-border p-1.5 hover:text-foreground"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
              title="More actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-36 rounded-md border border-border bg-background p-1 shadow-lg">
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  type="button"
                >
                  <PencilLine className="h-3 w-3" />
                  Edit
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
                  onClick={() => {
                    setMenuOpen(false);
                    onDuplicate();
                  }}
                  type="button"
                >
                  <Copy className="h-3 w-3" />
                  Duplicate
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggle(!rule.enabled);
                  }}
                  type="button"
                >
                  {rule.enabled ? "Disable" : "Enable"}
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
      </div>
    </div>
  );
}

function summarizeFirstAction(action?: Rule["actions"][number]) {
  if (!action) return null;
  switch (action.type) {
    case "move":
      return {
        icon: <MoveRight className="h-3 w-3" />,
        label: `Move to ${action.destination || "…"}`
      };
    case "copy":
      return {
        icon: <Copy className="h-3 w-3" />,
        label: `Copy to ${action.destination || "…"}`
      };
    case "sortIntoSubfolder":
      return {
        icon: <FolderInput className="h-3 w-3" />,
        label: `Sort into ${action.destination || "…"}`
      };
    case "rename":
      return {
        icon: <PencilLine className="h-3 w-3" />,
        label: `Rename to ${action.pattern || "…"}`
      };
    case "delete":
      return {
        icon: <Trash2 className="h-3 w-3" />,
        label: "Move to trash"
      };
    case "deletePermanently":
      return {
        icon: <Trash2 className="h-3 w-3" />,
        label: "Delete permanently"
      };
    case "runScript":
      return {
        icon: <Terminal className="h-3 w-3" />,
        label: action.command ? `Run ${action.command}` : "Run script"
      };
    case "notify":
      return {
        icon: <Bell className="h-3 w-3" />,
        label: action.message ? `Notify "${action.message}"` : "Send notification"
      };
    case "ignore":
      return {
        icon: <Sparkles className="h-3 w-3" />,
        label: "Ignore file"
      };
    default:
      return null;
  }
}
