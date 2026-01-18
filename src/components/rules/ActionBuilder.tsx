import { Plus, X } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import type { Action, ArchiveFormat, ConflictResolution } from "@/types";

interface ActionBuilderProps {
  actions: Action[];
  onChange: (actions: Action[]) => void;
}

const actionTypes = [
  { value: "move", label: "Move" },
  { value: "copy", label: "Copy" },
  { value: "rename", label: "Rename" },
  { value: "sortIntoSubfolder", label: "Sort into subfolder" },
  { value: "archive", label: "Archive" },
  { value: "unarchive", label: "Unarchive" },
  { value: "delete", label: "Delete (Trash)" },
  { value: "deletePermanently", label: "Delete Permanently" },
  { value: "runScript", label: "Run Script" },
  { value: "notify", label: "Notify" },
  { value: "open", label: "Open (Default App)" },
  { value: "pause", label: "Pause" },
  { value: "continue", label: "Continue Matching Rules" },
  { value: "ignore", label: "Ignore" },
];

const conflictOptions: { value: ConflictResolution; label: string }[] = [
  { value: "rename", label: "Rename" },
  { value: "replace", label: "Replace" },
  { value: "skip", label: "Skip" },
];

const fieldClass =
  "rounded-md border border-[#2a2b31] bg-[#141518] px-2.5 py-1.5 text-[11px] text-[#e7e1d8] shadow-none outline-none transition focus:border-[#c07a46] focus:ring-1 focus:ring-[#c07a46]/30";
const longFieldClass = `${fieldClass} min-w-[220px]`;

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
    <div className="space-y-3">
      {actions.map((action, index) => (
        <GlassCard key={index} className="p-3">
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
              className="ml-auto rounded-md border border-transparent p-1 text-[#8c8780] transition-colors hover:border-[#2a2b31] hover:bg-[#1f2025] hover:text-[#e7e1d8]"
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
        className="inline-flex items-center gap-2 rounded-md border border-[#2a2b31] bg-[#15171a] px-3 py-1.5 text-[11px] font-semibold text-[#cfc9bf] transition-colors hover:border-[#3a3b42]"
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
    case "archive":
      return {
        type: "archive",
        destination: "",
        format: "zip",
        deleteAfter: false,
      };
    case "unarchive":
      return {
        type: "unarchive",
        destination: "",
        deleteAfter: false,
      };
    case "delete":
      return { type: "delete", permanent: false };
    case "deletePermanently":
      return { type: "deletePermanently", permanent: true };
    case "runScript":
      return { type: "runScript", command: "" };
    case "notify":
      return { type: "notify", message: "" };
    case "open":
      return { type: "open" };
    case "pause":
      return { type: "pause", durationSeconds: 5 };
    case "continue":
      return { type: "continue" };
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
          className={longFieldClass}
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
          <label className="flex items-center gap-2 text-[11px] text-[#8c8780]">
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
          className={longFieldClass}
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

  if (action.type === "archive") {
    return (
      <>
        <input
          className={longFieldClass}
          placeholder="Destination (folder or file path)"
          value={action.destination}
          onChange={(e) => onChange({ ...action, destination: e.target.value })}
        />
        <select
          className={fieldClass}
          value={action.format}
          onChange={(e) =>
            onChange({
              ...action,
              format: e.target.value as ArchiveFormat,
            })
          }
        >
          <option value="zip">zip</option>
          <option value="tar">tar</option>
          <option value="tarGz">tar.gz</option>
        </select>
        <label className="flex items-center gap-2 text-[11px] text-[#8c8780]">
          <input
            type="checkbox"
            checked={action.deleteAfter}
            onChange={(e) => onChange({ ...action, deleteAfter: e.target.checked })}
          />
          Delete original
        </label>
      </>
    );
  }

  if (action.type === "unarchive") {
    return (
      <>
        <input
          className={longFieldClass}
          placeholder="Destination (optional)"
          value={action.destination ?? ""}
          onChange={(e) =>
            onChange({ ...action, destination: e.target.value || undefined })
          }
        />
        <label className="flex items-center gap-2 text-[11px] text-[#8c8780]">
          <input
            type="checkbox"
            checked={action.deleteAfter}
            onChange={(e) => onChange({ ...action, deleteAfter: e.target.checked })}
          />
          Delete archive
        </label>
      </>
    );
  }

  if (action.type === "runScript") {
    return (
      <input
        className={longFieldClass}
        placeholder="Command"
        value={action.command}
        onChange={(e) => onChange({ ...action, command: e.target.value })}
      />
    );
  }

  if (action.type === "notify") {
    return (
      <input
        className={longFieldClass}
        placeholder="Notification message"
        value={action.message}
        onChange={(e) => onChange({ ...action, message: e.target.value })}
      />
    );
  }

  if (action.type === "pause") {
    return (
      <>
        <input
          className={`${fieldClass} w-20`}
          type="number"
          min={1}
          value={action.durationSeconds}
          onChange={(e) =>
            onChange({ ...action, durationSeconds: Number(e.target.value) })
          }
        />
        <span className="text-[11px] text-[#8c8780]">seconds</span>
      </>
    );
  }

  return null;
}
