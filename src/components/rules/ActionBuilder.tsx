import { Plus, X } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import type { Action, ConflictResolution } from "@/types";

interface ActionBuilderProps {
  actions: Action[];
  onChange: (actions: Action[]) => void;
}

const actionTypes = [
  { value: "move", label: "Move" },
  { value: "copy", label: "Copy" },
  { value: "rename", label: "Rename" },
  { value: "sortIntoSubfolder", label: "Sort into subfolder" },
  { value: "delete", label: "Delete (Trash)" },
  { value: "deletePermanently", label: "Delete Permanently" },
  { value: "runScript", label: "Run Script" },
  { value: "notify", label: "Notify" },
  { value: "ignore", label: "Ignore" },
];

const conflictOptions: { value: ConflictResolution; label: string }[] = [
  { value: "rename", label: "Rename" },
  { value: "replace", label: "Replace" },
  { value: "skip", label: "Skip" },
];

const fieldClass =
  "rounded-xl border border-white/50 bg-white/70 px-3 py-1.5 text-xs text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20";

export function ActionBuilder({ actions, onChange }: ActionBuilderProps) {
  const updateAction = (index: number, updated: Action) => {
    const next = [...actions];
    next[index] = updated;
    onChange(next);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, idx) => idx !== index));
  };

  const addAction = (type = "move") => {
    onChange([...actions, createAction(type)]);
  };

  return (
    <div className="space-y-4">
      {actions.map((action, index) => (
        <GlassCard key={index} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={fieldClass}
              value={action.type}
              onChange={(e) => updateAction(index, createAction(e.target.value))}
            >
              {actionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {renderActionFields(action, (updated) => updateAction(index, updated))}
            <button
              className="ml-auto rounded-full border border-transparent p-1 text-slate-400 transition-colors hover:border-white/40 hover:bg-white/60 hover:text-slate-700 dark:text-neutral-500 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:text-neutral-200"
              onClick={() => removeAction(index)}
              type="button"
              aria-label="Remove action"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </GlassCard>
      ))}
      <button
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-white/40 bg-white/40 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:bg-white/70 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
        type="button"
        onClick={() => addAction()}
      >
        <Plus className="h-4 w-4" />
        Add Action
      </button>
    </div>
  );
}

function createAction(type: string): Action {
  switch (type) {
    case "copy":
      return {
        type: "copy",
        destination: "",
        onConflict: "rename",
        skipDuplicates: false,
      };
    case "rename":
      return { type: "rename", pattern: "", onConflict: "rename" };
    case "sortIntoSubfolder":
      return { type: "sortIntoSubfolder", destination: "", onConflict: "rename" };
    case "delete":
      return { type: "delete", permanent: false };
    case "deletePermanently":
      return { type: "deletePermanently", permanent: true };
    case "runScript":
      return { type: "runScript", command: "" };
    case "notify":
      return { type: "notify", message: "" };
    case "ignore":
      return { type: "ignore" };
    case "move":
    default:
      return {
        type: "move",
        destination: "",
        onConflict: "rename",
        skipDuplicates: false,
      };
  }
}

function renderActionFields(action: Action, onChange: (action: Action) => void) {
  if (action.type === "move" || action.type === "copy" || action.type === "sortIntoSubfolder") {
    return (
      <>
        <input
          className="min-w-[240px] rounded-xl border border-white/50 bg-white/70 px-3 py-1.5 text-xs text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
          placeholder="Destination path"
          value={action.destination}
          onChange={(e) => onChange({ ...action, destination: e.target.value })}
        />
        <select
          className={fieldClass}
          value={action.onConflict}
          onChange={(e) =>
            onChange({ ...action, onConflict: e.target.value as ConflictResolution })
          }
        >
          {conflictOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {action.type !== "sortIntoSubfolder" ? (
          <label className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={action.skipDuplicates}
              onChange={(e) => onChange({ ...action, skipDuplicates: e.target.checked })}
            />
            Skip duplicates
          </label>
        ) : null}
      </>
    );
  }

  if (action.type === "rename") {
    return (
      <>
        <input
          className="min-w-[240px] rounded-xl border border-white/50 bg-white/70 px-3 py-1.5 text-xs text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
          placeholder="New name pattern"
          value={action.pattern}
          onChange={(e) => onChange({ ...action, pattern: e.target.value })}
        />
        <select
          className={fieldClass}
          value={action.onConflict}
          onChange={(e) =>
            onChange({ ...action, onConflict: e.target.value as ConflictResolution })
          }
        >
          {conflictOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </>
    );
  }

  if (action.type === "runScript") {
    return (
      <input
        className="min-w-[260px] rounded-xl border border-white/50 bg-white/70 px-3 py-1.5 text-xs text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
        placeholder="Command"
        value={action.command}
        onChange={(e) => onChange({ ...action, command: e.target.value })}
      />
    );
  }

  if (action.type === "notify") {
    return (
      <input
        className="min-w-[260px] rounded-xl border border-white/50 bg-white/70 px-3 py-1.5 text-xs text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
        placeholder="Notification message"
        value={action.message}
        onChange={(e) => onChange({ ...action, message: e.target.value })}
      />
    );
  }

  return null;
}
